import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = 3000;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "world",
  password: "ayush08",
  port: 5432,
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let currentUserId = 1;

// Function to fetch all users from the database
async function getAllUsers() {
  const result = await db.query("SELECT * FROM users");
  return result.rows; // Return all users from the database
}

// Function to check which countries the current user has visited
async function checkVisited() {
  const result = await db.query(
    "SELECT country_code FROM visited_countries JOIN users ON users.id = user_id WHERE user_id = $1;",
    [currentUserId]
  );
  let countries = [];
  result.rows.forEach((country) => {
    countries.push(country.country_code);
  });
  return countries;
}

// Function to get the current user's details
async function getCurrentUser() {
  const result = await db.query("SELECT * FROM users WHERE id = $1", [currentUserId]);
  return result.rows[0]; // Return the user object, or undefined if not found
}

// Handle the main route
app.get("/", async (req, res) => {
  const countries = await checkVisited();
  const currentUser = await getCurrentUser();
  const users = await getAllUsers(); // Fetch all users from the database

  if (!currentUser) {
    return res.status(404).send("User not found");
  }

  res.render("index.ejs", {
    countries: countries,
    total: countries.length,
    users: users, // Send all users to the template
    color: currentUser.color || "defaultColor", // Fallback color if user doesn't have one
  });
});

// Handle adding a new country to the current user
app.post("/add", async (req, res) => {
  const input = req.body["country"];
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return res.status(404).send("User not found");
  }

  try {
    // Find the country by name
    const result = await db.query(
      "SELECT country_code FROM countries WHERE LOWER(country_name) LIKE '%' || $1 || '%';",
      [input.toLowerCase()]
    );

    const data = result.rows[0];
    if (data) {
      const countryCode = data.country_code;

      // Check if the country has already been visited by the current user
      const existingVisit = await db.query(
        "SELECT * FROM visited_countries WHERE country_code = $1 AND user_id = $2",
        [countryCode, currentUserId]
      );

      if (existingVisit.rows.length > 0) {
        // Country already visited, prevent re-insertion
        res.status(400).send("This country has already been added.");
      } else {
        // Country not visited, proceed with adding
        try {
          await db.query(
            "INSERT INTO visited_countries (country_code, user_id) VALUES ($1, $2)",
            [countryCode, currentUserId]
          );
          res.redirect("/");
        } catch (err) {
          console.log(err);
          res.status(500).send("Error inserting visited country");
        }
      }
    } else {
      res.status(404).send("Country not found");
    }
  } catch (err) {
    console.log(err);
    res.status(500).send("Error querying country");
  }
});

// Handle user selection or adding a new user
app.post("/user", async (req, res) => {
  if (req.body.add === "new") {
    res.render("new.ejs");
  } else {
    currentUserId = req.body.user;
    res.redirect("/");
  }
});

// Handle creating a new user
app.post("/new", async (req, res) => {
  const name = req.body.name;
  const color = req.body.color;

  try {
    const result = await db.query(
      "INSERT INTO users (name, color) VALUES($1, $2) RETURNING *;",
      [name, color]
    );

    const id = result.rows[0].id;
    currentUserId = id;

    res.redirect("/");
  } catch (err) {
    console.log(err);
    res.status(500).send("Error creating new user");
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
