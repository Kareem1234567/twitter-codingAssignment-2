const express = require("express");
const app = express();
app.use(express.json());

const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

const path = require("path");
const db_path = path.join(__dirname, "twitterClone.db");

let db = null;

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const initializeDbAndServer = async () => {
  db = await open({ filename: db_path, driver: sqlite3.Database });
  app.listen(3000, () => {
    try {
      console.log("server running at http://localhost:3000");
    } catch (error) {
      console.log(`DB ERROR ${error.message}`);
      process.exit(1);
    }
  });
};
initializeDbAndServer();

const authenticateToken = (request, response, next) => {
  let authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    authHeader = authHeader.split(" ");
    const jwtToken = authHeader[1];
    jwt.verify(jwtToken, "SECRET_KEY", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  } else {
    response.status(401);
    response.send("Invalid JWT Token");
  }
};

// API 1 POST
app.post("/register/", async (request, response) => {
  try {
    const { username, password, name, gender } = request.body;
    const checkUser = `
        SELECT
        *
        FROM
        user
        WHERE
        username='${username}';`;
    const dbResponse = await db.all(checkUser);
    if (dbResponse.length > 0) {
      response.status(400);
      response.send("User already exists");
    } else {
      if (password.length < 6) {
        response.status(400);
        response.send("Password is too short");
      } else {
        const hashedPassword = await bcrypt.hash(password, 10);
        const Query = `
                INSERT INTO
                user ( name,username,password,gender)
                VALUES
                (
                        "${name}",
                        "${username}",
                        "${hashedPassword}",
                        "${gender}"
                        );`;
        await db.run(Query);
        response.send("User created successfully");
      }
    }
  } catch (error) {
    console.log(`ERROR API ${error.message}`);
  }
});
//API 2 POST
app.post("/login/", async (request, response) => {
  try {
    const { username, password } = request.body;
    const checkUser = `
                SELECT
                *
                FROM
                user
                WHERE
                username='${username}';`;
    const dbResponse = await db.get(checkUser);
    if (dbResponse !== undefined) {
      const passwordCheck = await bcrypt.compare(password, dbResponse.password);
      if (passwordCheck === false) {
        response.status(400);
        response.send("Invalid password");
      } else {
        const payload = { username: username };
        const jwtToken = jwt.sign(payload, "SECRET_KEY");
        response.send({ jwtToken: jwtToken });
      }
    } else {
      response.status(400);
      response.send("Invalid user");
    }
  } catch (error) {
    console.log(`ERROR API ${error.message}`);
  }
});

// API 3 GET
app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  try {
    const username = request.username;
    const getUserIdQuery = `
    SELECT 
        user_id
    FROM 
        user
    WHERE
        username='${username}';`;
    const userId = await db.get(getUserIdQuery);
    const getFollowingQuery = `
    SELECT 
        user.username as username,tweet,date_time as dateTime
    FROM
       (follower INNER JOIN tweet ON follower.following_user_id=tweet.user_id) NATURAL JOIN user
    WHERE
        follower.follower_user_id=4
    ORDER BY 
        date_time DESC
    LIMIT 4;`;
    const results = await db.all(getFollowingQuery);
    response.send(results);
  } catch (error) {
    console.log(`ERROR API ${error.message}`);
  }
});

// API 4 GET
app.get("/user/following/", authenticateToken, async (request, response) => {
  try {
    const username = request.username;
    const getUserIdQuery = `
    SELECT 
        user_id
    FROM 
        user
    WHERE
        username='${username}';`;
    const userId = await db.get(getUserIdQuery);
    const getFollowingQuery = `
    SELECT 
        name
    FROM
        follower INNER JOIN user ON follower.following_user_id=user.user_id
    WHERE
        follower.follower_user_id=4;`;
    const results = await db.all(getFollowingQuery);
    response.send(results);
  } catch (error) {
    console.log(`ERROR API ${error.message}`);
  }
});

// API 5 GET
app.get("/user/followers/", authenticateToken, async (request, response) => {
  try {
    const username = request.username;
    const getUserIdQuery = `
    SELECT 
        user_id
    FROM 
        user
    WHERE
        username='${username}';`;
    const userId = await db.get(getUserIdQuery);
    const getFollowingQuery = `
    SELECT 
        name
    FROM
        follower INNER JOIN user ON follower.follower_user_id=user.user_id
    WHERE
        follower.following_user_id=4;`;
    const results = await db.all(getFollowingQuery);
    response.send(results);
  } catch (error) {
    console.log(`ERROR API ${error.message}`);
  }
});

// API 6 GET
app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  try {
    const { tweetId } = request.params;
    const username = request.username;
    const getUserIdQuery = `
        SELECT 
        user_id
        FROM 
        user
        WHERE
        username='${username}';`;
    const userId = await db.get(getUserIdQuery);
    const getFollowingQuery = `
        SELECT
        DISTINCT(tweet_id)
        FROM
        follower INNER JOIN tweet ON follower.following_user_id=tweet.user_id
        WHERE
        follower.follower_user_id=4 and
        tweet.tweet_id=${tweetId};`;
    const results = await db.get(getFollowingQuery);
    if (results === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const tweetInfoQuery = `
            SELECT
            tweet,count(DISTINCT(like_id))as likes,count(DISTINCT(reply_id))as replies,date_time as dateTime
            FROM
            (tweet INNER JOIN like ON tweet.tweet_id=like.tweet_id ) as T INNER JOIN reply ON T.tweet_id = reply.tweet_id
            WHERE 
            tweet.tweet_id= ${tweetId};`;
      const dbResponse = await db.get(tweetInfoQuery);
      response.send(dbResponse);
    }
  } catch (error) {
    console.log(`ERROR API ${error.message}`);
  }
});

// API 7 GET
app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    try {
      const { tweetId } = request.params;
      const username = request.username;
      const getUserIdQuery = `
    SELECT 
        user_id
    FROM 
        user
    WHERE
        username='${username}';`;
      const userId = await db.get(getUserIdQuery);
      const getFollowingQuery = `
    SELECT
        DISTINCT(tweet_id)
    FROM
        follower INNER JOIN tweet ON follower.following_user_id=tweet.user_id
    WHERE
        follower.follower_user_id=4 and
        tweet.tweet_id=${tweetId};`;
      const results = await db.get(getFollowingQuery);
      if (results === undefined) {
        response.status(401);
        response.send("Invalid Request");
      } else {
        const tweetInfoQuery = `
       SELECT
            username
       FROM
           like NATURAL JOIN user
       WHERE 
            tweet_id= ${tweetId};`;
        const dbResponse = await db.all(tweetInfoQuery);
        const names = [];
        for (let i = 0; i < dbResponse.length; i++) {
          names.push(dbResponse[i].username);
        }
        response.send({ likes: names });
      }
    } catch (error) {
      console.log(`ERROR API ${error.message}`);
    }
  }
);
// API 8 GET
app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    try {
      const { tweetId } = request.params;
      const username = request.username;
      const getUserIdQuery = `
    SELECT 
        user_id
    FROM 
        user
    WHERE
        username='${username}';`;
      const userId = await db.get(getUserIdQuery);
      const getFollowingQuery = `
    SELECT
        DISTINCT(tweet_id)
    FROM
        follower INNER JOIN tweet ON follower.following_user_id=tweet.user_id
    WHERE
        follower.follower_user_id=4 and
        tweet.tweet_id=${tweetId};`;
      const results = await db.get(getFollowingQuery);
      if (results === undefined) {
        response.status(401);
        response.send("Invalid Request");
      } else {
        const tweetInfoQuery = `
       SELECT
            name,reply
       FROM
           reply NATURAL JOIN user
       WHERE
            tweet_id= ${tweetId};`;
        const dbResponse = await db.all(tweetInfoQuery);
        response.send({ replies: dbResponse });
      }
    } catch (error) {
      console.log(`ERROR API ${error.message}`);
    }
  }
);

// API 9 GET
app.get("/user/tweets/", authenticateToken, async (request, response) => {
  try {
    const username = request.username;
    const getUserIdQuery = `
    SELECT 
        user_id
    FROM
        user
    WHERE
        username='${username}';`;
    const userId = await db.get(getUserIdQuery);
    const getFollowingQuery = `
    SELECT
        tweet,count(DISTINCT(like_id)) as likes,count(DISTINCT(reply_id)) as replies,date_time as dateTime
    FROM
        (tweet INNER JOIN  like ON tweet.user_id=like.user_id) as T INNER JOIN reply ON T.user_id= reply.user_id
    WHERE 
        tweet.user_id=${userId.user_id}
    GROUP BY
        tweet.tweet_id
        ;`;
    const results = await db.all(getFollowingQuery);
    response.send(results);
  } catch (error) {
    console.log(`ERROR API ${error.message}`);
  }
});
// API 10 POST
app.post("/user/tweets/", authenticateToken, async (request, response) => {
  try {
    const { tweet } = request.body;
    const addTweetQuery = `
    INSERT INTO
        tweet (tweet)
    VALUES
        (
            '${tweet}'
        );`;
    await db.run(addTweetQuery);
    response.send("Created a Tweet");
  } catch (error) {
    console.log(`ERROR API ${error.message}`);
  }
});

// API 11 DELETE
app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    try {
      const { tweetId } = request.params;
      const username = request.username;
      const getUserIdQuery = `
    SELECT 
        user_id
    FROM 
        user
    WHERE
        username='${username}';`;
      const userId = await db.get(getUserIdQuery);
      const GetDbUserID = `
      SELECT 
        user_id
      FROM 
        tweet
      WHERE 
        tweet_id=${tweetId};`;
      const dbUserID = await db.get(GetDbUserID);
      if (userId.user_id === dbUserID.user_id) {
        const deleteTweetQuery = `
        DELETE FROM
            tweet
        WHERE
            tweet_id=${tweetId};`;
        await db.run(deleteTweetQuery);
        response.send("Tweet Removed");
      } else {
        response.status(401);
        response.send("Invalid Request");
      }
    } catch (error) {
      console.log(`ERROR API ${error.message}`);
    }
  }
);

module.exports = app;
