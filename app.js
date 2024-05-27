const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const bcrypt = require('bcrypt');
const cors = require('cors');
const path = require('path');

const app = express();
const port = 8081;

const corsOptions = {
    origin: ['http://127.0.0.1:8080', 'http://localhost:8081' , 'http://localhost:8081/book'],
    optionsSuccessStatus: 200 
};



app.use(bodyParser.json());
app.use(cors(corsOptions));

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Test@12345',
    database: 'bus_booking'
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to database: ' + err.stack);
        return;
    }
    console.log('Connected to database as ID ' + connection.threadId);
});


app.use(express.static(path.join(__dirname, 'public')));


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});


app.get('/seats/:bus_number', (req, res) => {
    const busNumber = req.params.bus_number;
    const query = 'SELECT seat_number FROM bookings WHERE bus_number = ? AND is_booked = TRUE';
    connection.query(query, [busNumber], (error, results) => {
        if (error) {
            console.error('Error fetching booked seats:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
        res.json(results.map(row => row.seat_number));
    });
});


app.post('/book/:bus_number', (req, res) => {
    const busNumber = req.params.bus_number;
    const seats = req.body.seats;

    if (!seats || seats.length === 0) {
        return res.status(400).json({ error: 'No seats selected' });
    }

    const bookingQueries = seats.map(seat => {
        return new Promise((resolve, reject) => {
            connection.query('INSERT INTO bookings (bus_number, seat_number, is_booked) VALUES (?, ?, TRUE) ON DUPLICATE KEY UPDATE is_booked = TRUE', [busNumber, seat], (error, results) => {
                if (error) {
                    return reject(error);
                }
                resolve(results);
            });
        });
    });

    Promise.all(bookingQueries)
        .then(() => {
            // Update the number of available seats
            connection.query('UPDATE buses SET available_seats = available_seats - ? WHERE bus_number = ?', [seats.length, busNumber], (error, results) => {
                if (error) {
                    console.error('Error updating available seats:', error);
                    return res.status(500).json({ error: 'Internal server error' });
                }
                res.status(200).json({ message: 'Booking successful' });
            });
        })
        .catch(error => {
            console.error('Error booking seats:', error);
            res.status(500).json({ error: 'Internal server error' });
        });
});

app.get('/buses', (req, res) => {
    const query = 'SELECT * FROM buses';
    connection.query(query, (error, results) => {
        if (error) {
            console.error('Error fetching buses:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
        res.json(results);
    });
});


// Register Route
app.post('/register', (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    const query = 'INSERT INTO users (username, email, password) VALUES (?, ?, ?)';
    connection.query(query, [username, email, password], (error, results) => {
        if (error) {
            console.error('Error inserting user:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
        res.status(201).json({ message: 'User registered successfully', userId: results.insertId });
    });
});

// Login Route
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    const query = 'SELECT * FROM users WHERE email = ?';
    connection.query(query, [email], (error, results) => {
        if (error) {
            console.error('Error fetching user: ' + error);
            return res.status(500).json({ error: 'Internal server error' });
        }

        if (results.length === 0) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }

        const user = results[0];
        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) {
                console.error('Error comparing passwords: ' + err);
                return res.status(500).json({ error: 'Internal server error' });
            }

            if (!isMatch) {
                return res.status(400).json({ error: 'Invalid email or password' });
            }

            res.json({ message: 'Login successful' });
        });
    });
});


app.get('/book', (req, res) => {
    const busNumber = req.query.bus_number;
    res.sendFile(path.join(__dirname, 'public', 'book.html'));
});



// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
