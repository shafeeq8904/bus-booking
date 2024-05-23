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



app.post('/book/:bus_number', (req, res) => {
    const busNumber = req.params.bus_number;

    connection.query('SELECT * FROM buses WHERE bus_number = ?', [busNumber], (error, results) => {
        if (error) {
            console.error('Error fetching bus:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'Bus not found' });
        }

        const bus = results[0];

        if (bus.available_seats > 0) {
            const newAvailableSeats = bus.available_seats - 1;
            console.log(newAvailableSeats, busNumber)
            connection.query('UPDATE buses SET available_seats = ? WHERE bus_number = ?', [newAvailableSeats, busNumber], (error, updateResults) => {
                if (error) {
                    console.error('Error updating bus:', error);
                    return res.status(500).json({ error: 'Internal server error' });
                }
                res.status(200).json({ message: 'Booking successful', bus_number: busNumber, available_seats: newAvailableSeats });
            });
        } else {
            res.status(400).json({ error: 'No available seats' });
        }
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






// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
