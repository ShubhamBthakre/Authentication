const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "goodreads.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

// Get Books API
app.get("/books/", async (request, response) => {
  let jwtToken;

  const authHeader = request.headers["authorization"]; // Authorization=authorization

  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }

  if (authHeader === undefined) {
    response.status(400);
    response.send("Please provide access token");
  } else {
    //secret_key should be same provided as login API
    jwt.verify(jwtToken, "secret_key", async (error, payload) => {
      if (error) {
        response.send("Invalid Access token");
      } else {
        const getBooksQuery = `
                SELECT
                    *
                FROM
                    book
                ORDER BY
                    book_id;`;
        const booksArray = await db.all(getBooksQuery);
        response.send(booksArray);
      }
    });
  }
});

//Register User API
app.post("/users/", async (request, response) => {
  const { username, name, password, gender, location } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    const createUserQuery = `
      INSERT INTO 
        user (username, name, password, gender, location) 
      VALUES 
        (
          '${username}', 
          '${name}',
          '${hashedPassword}', 
          '${gender}',
          '${location}'
        )`;
    const dbResponse = await db.run(createUserQuery);
    const newUserId = dbResponse.lastID;
    response.send(`Created new user with ${newUserId}`);
  } else {
    response.status = 400;
    response.send("User already exists");
  }
});

//Login User API
app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid User");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwt_token = jwt.sign(payload, "secret_key"); //we can provide any value as secret key
      response.send({ jwt_token });
    } else {
      response.status(400);
      response.send("Invalid Password");
    }
  }
});
