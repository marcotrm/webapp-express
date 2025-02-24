const express = require("express");
const mysql = require("mysql2/promise");
const path = require("path");
require("dotenv").config();

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Configurazione del database
const dbConfig = {
  host: "localhost",
  user: "root",
  password: "OpoApa1926!",
  database: "movies_db",
};

// Funzione per ottenere la connessione al database
async function getConnection() {
  try {
    const connection = await mysql.createConnection(dbConfig);
    return connection;
  } catch (error) {
    console.error("Errore nella connessione al database:", error);
    throw error;
  }
}

// index
app.get("/api/movies", async (req, res) => {
  try {
    const connection = await getConnection();
    const [movies] = await connection.execute(`
      SELECT id, title, director, genre, release_year, image 
      FROM movies 
      ORDER BY title
    `);

    const moviesWithImagePaths = movies.map((movie) => {
      if (movie.image) {
        movie.image_url = `/images/${movie.image}`;
      } else {
        movie.image_url = null;
      }
      return movie;
    });

    await connection.end();
    res.status(200).json(moviesWithImagePaths);
  } catch (error) {
    console.error("Errore nel recupero dei film:", error);
    res
      .status(500)
      .json({ error: "Errore nel recupero dei film", details: error.message });
  }
});

// show
app.get("/api/movies/:id", async (req, res) => {
  try {
    const movieId = req.params.id;
    const connection = await getConnection();

    const [movies] = await connection.execute(
      `
      SELECT id, title, director, genre, release_year, abstract, image
      FROM movies 
      WHERE id = ?
    `,
      [movieId]
    );

    if (movies.length === 0) {
      await connection.end();
      return res.status(404).json({ error: "Film non trovato" });
    }

    const movie = movies[0];
    if (movie.image) {
      movie.image_url = `/images/${movie.image}`;
    } else {
      movie.image_url = null;
    }

    // recensioni
    const [reviews] = await connection.execute(
      `
      SELECT id, name, vote, text, created_at
      FROM reviews
      WHERE movie_id = ?
      ORDER BY created_at DESC
    `,
      [movieId]
    );

    // media voti
    let averageVote = 0;
    if (reviews.length > 0) {
      const totalVotes = reviews.reduce((sum, review) => sum + review.vote, 0);
      averageVote = (totalVotes / reviews.length).toFixed(1);
    }

    const result = {
      ...movie,
      average_vote: parseFloat(averageVote),
      reviews_count: reviews.length,
      reviews: reviews,
    };

    await connection.end();
    res.status(200).json(result);
  } catch (error) {
    console.error("Errore nel recupero del film:", error);
    res
      .status(500)
      .json({ error: "Errore nel recupero del film", details: error.message });
  }
});

// Rotta per aggiungere una recensione
app.post("/api/movies/:id/reviews", async (req, res) => {
  try {
    const movieId = req.params.id;
    const { name, vote, text } = req.body;

    if (!name || !vote || vote < 1 || vote > 5) {
      return res.status(400).json({
        error: "Dati non validi",
        message: "Il nome e il voto (tra 1 e 5) sono obbligatori",
      });
    }

    const connection = await getConnection();

    // Verifica che il film esista
    const [movies] = await connection.execute(
      "SELECT id FROM movies WHERE id = ?",
      [movieId]
    );

    if (movies.length === 0) {
      await connection.end();
      return res.status(404).json({ error: "Film non trovato" });
    }

    // Inserisci la recensione
    const [result] = await connection.execute(
      "INSERT INTO reviews (movie_id, name, vote, text) VALUES (?, ?, ?, ?)",
      [movieId, name, vote, text || null]
    );

    // Ottieni la recensione appena inserita
    const [newReviews] = await connection.execute(
      "SELECT id, name, vote, text, created_at FROM reviews WHERE id = ?",
      [result.insertId]
    );

    await connection.end();
    res.status(201).json(newReviews[0]);
  } catch (error) {
    console.error("Errore nell'aggiunta della recensione:", error);
    res.status(500).json({
      error: "Errore nell'aggiunta della recensione",
      details: error.message,
    });
  }
});

// Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server in esecuzione sulla porta ${PORT}`);
});

module.exports = app;
