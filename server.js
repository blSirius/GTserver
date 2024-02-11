const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { log } = require('console');

const app = express();
const port = 3000;

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(cors());
app.use(express.json());

const secretKey = 'PeemSecert';

// PostgreSQL configuration
const pool = new Pool({
  user: 'fuvesvmt',
  host: 'hansken.db.elephantsql.com',
  database: 'fuvesvmt',
  password: 'g4EZeujJI54nL2Jum3MNhglHEvJD4vvU',
  port: 5432,
});

/*         Kiosk               */

app.post('/postFaceDetected', async (req, res) => {
  const { name, expression, age, gender, single_img, date, time } = req.body;
  try {
    const get_greeting = await pool.query("SELECT greeting FROM expression WHERE emotion = $1 ORDER BY RANDOM() LIMIT 1", [expression]);
    const greeting = get_greeting.rows[0].greeting;
    const result = await pool.query(
      'INSERT INTO face_detection (name, expression, age, gender, single_img, date, time, greeting) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [name, expression, age, gender, single_img, date, time, greeting]
    );
    res.json('postFaceDetected successfully');
  } catch (err) {
    console.log(err);
    res.status(500).send(err);
  }
});

app.get('/getFaceDetected', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM face_detection WHERE name != 'unknown' ORDER BY id DESC LIMIT 5");
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching face detections:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



/*          Web App            */

app.get('/getFaceDetectedHome', async (req, res) => {
  // Format today's date as D/M/YYYY (without leading zeros for day and month)
  const today = new Date();
  const formattedDate = [
    today.getDate(), // Day without leading zero
    today.getMonth() + 1, // Month without leading zero (January is 0!)
    today.getFullYear(),
  ].join('/');

  try {
    const query = "SELECT * FROM face_detection WHERE name != 'unknown' AND date = $1 ORDER BY id DESC";
    const result = await pool.query(query, [formattedDate]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching face detections:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



app.post('/register', async (req, res) => {
  const { username, password, status } = req.body;

  try {
    // Password hashing disabled for simplicity. It should be enabled in production.
    const result = await pool.query(
      'INSERT INTO authentication (username, password, status) VALUES ($1, $2, $3) RETURNING *',
      [username, password, status]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM authentication WHERE username = $1 AND password = $2', [username, password]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const token = jwt.sign({ username: username }, secretKey, { expiresIn: '1h' });

    res.json({ message: 'Login successful', token: token });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/decodeToken', (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Token not provided' });
  }

  jwt.verify(token, secretKey, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    res.json({ message: 'decoded success', decoded: decoded });
  });
});

app.post('/createEmployee', async (req, res) => {
  const { name, username, email } = req.body;

  try {
    // Note: email field added to match the first version
    const result = await pool.query('INSERT INTO employee (employee_name, employee_username, employee_email, employee_picpath) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, username, email, name]); // Assuming employee_picpath is intended to store the name for simplicity.

    console.log(result);

    res.status(201).json(result.rows[0]);
  }
  catch (err) {
    console.error('Error during createEmployee:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/getEmployee', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM employee');
    console.log(result.rows);
    res.status(201).json(result.rows);
  }
  catch (error) {
    res.status(500).send(error.message);
  }
});

app.get('/getEmployeeDetail/:id', async (req, res) => {
  const empID = parseInt(req.params.id, 10); // Parse empID to an integer
  try {
    const result = await pool.query('SELECT * FROM employee WHERE employee_id = $1', [empID]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Employee not found' });
    } else {
      res.json(result.rows[0]);
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
});
app.get('/getEmpDetect/:name', async (req, res) => {
  const name = req.params.name;
  try {
    const result = await pool.query('SELECT * FROM face_detection WHERE name = $1', [name]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching face detections:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// app.get('/getImageFolder/:name', (req, res) => {
//   const name = decodeURIComponent(req.params.name);
//   const dirPath = path.join(__dirname, 'labels', name);

//   fs.readdir(dirPath, (err, files) => {
//     if (err) {
//       console.error('Error reading directory:', dirPath);
//       return res.status(500).json({ error: 'Failed to read directory' });
//     }

//     // Filter out non-image files if necessary, assuming PNG images for simplicity
//     const imageFiles = files.filter(file => file.endsWith('.png'));

//     // Convert file names to URLs
//     const imageUrls = imageFiles.map(file => `http://localhost:3000/labels/${encodeURIComponent(name)}/${file}`);

//     res.json(imageUrls);
//   });
// });

app.delete('/deleteEmployee/:id', async (req, res) => {
  const empID = parseInt(req.params.id, 10);
  try {
    const result = await pool.query('DELETE FROM employee WHERE id = $1', [empID]);
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Employee not found' });
    } else {
      res.status(204).send(); // 204 No Content for successful deletion
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
});

/*       Folder Management         */
app.use('/getImageFolder', express.static('labels'));
app.use('/getDetectedSingleFaceFolder', express.static('detectedSingleFace'));

app.get('/getLabelFolder', (req, res) => {
  try {
    const folders = fs.readdirSync('labels', { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    res.json({ folders });
  } catch (error) {
    console.error('Error getting folder names:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/updateImageFolder', upload.single('labels'), async (req, res) => {
  try {
    const folderName = req.body.folderName || req.query.folderName || 'defaultFolder';
    const folderPath = `labels/${folderName}`;
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
    const files = fs.readdirSync(folderPath);
    const newImageName = `${files.length + 1}.png`;
    const imagePath = path.join(folderPath, newImageName);
    fs.writeFileSync(imagePath, req.file.buffer);
    res.json('Successfully uploaded');
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/postDetectedSingleFaceFolder', upload.single('detectedSingleFace'), async (req, res) => {
  try {
    const folderName = req.body.folderName || req.query.folderName || 'defaultFolder';
    const folderPath = `detectedSingleFace/${folderName}`;

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const files = fs.readdirSync(folderPath);
    const newImageName = `${files.length + 1}.png`;
    const imagePath = path.join(folderPath, newImageName);

    fs.writeFileSync(imagePath, req.file.buffer);
    res.json(newImageName);

  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});