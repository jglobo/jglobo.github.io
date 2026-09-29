// Everything the game says or links to lives in this file.
// To update the portfolio, edit the data here; the maps pick it up automatically.

// Shown on the sign by the house and on the mailbox. Placeholder for now.
export const HOME_ADDRESS = {
    street: "123 Maple Street",
    city: "Hometown, TN 00000",
};

export const PLAYER_NAME = "JOSE";

// The mailbox form posts here through FormSubmit (the same service the old site used).
export const CONTACT_EMAIL = "jgl2j@yahoo.com";
export const CONTACT_ENDPOINT = `https://formsubmit.co/ajax/${CONTACT_EMAIL}`;

export const LINKS = {
    github: "https://github.com/jglobo",
    linkedin: "https://www.linkedin.com/in/jose-lobo-66591b140/",
    codepen: "https://codepen.io/Jglobo",
    tableau: "https://public.tableau.com/app/profile/jose.lobo6721",
    freecodecamp: "https://www.freecodecamp.org/fccf4c3a239-3f0e-4397-8d3b-77345a7aadea",
    resumePdf: "Jose_Lobo_pdf_Resume.pdf",
};

export const RESUME = {
    summary:
        "Self-taught software developer and Business Intelligence Analyst II at Envision Healthcare. I use SQL, Python and some R to turn claims data into insight for leadership, and I build games and apps in my spare time.",
    experience: [
        { role: "Business Intelligence Analyst II", org: "Envision Healthcare", when: "Current" },
        { role: "Data Analyst", org: "HCA Healthcare", when: "From April 2022", detail: "Power BI and Tableau dashboards, Teradata SQL, clinical data products, training and QA." },
        { role: "Process Technician IV", org: "DCIDS", when: "July 2019 to June 2021", detail: "Tissue bank processing in a sterile surgical setting, reporting and data entry." },
    ],
    skills: [
        ["Languages", "Python, SQL, JavaScript (D3.js), C++, HTML, CSS"],
        ["BI tools", "Power BI, Tableau, QlikSense, QlikView, Jupyter"],
        ["Databases", "Teradata, SQL Server, MySQL, SQLite, MongoDB"],
        ["Also", "DAX and LOD functions, Git and GitHub, JIRA, fluent in Spanish and English"],
    ],
    education: [
        "University of Medicine and Health Sciences, St. Kitts: coursework and clerkships",
        "Middle Tennessee State University: BS in Biology (Physiology), minor in Chemistry, Cum Laude",
    ],
};

// Trophies on the shelf at home. Add new ones to the top as they happen.
export const ACHIEVEMENTS = [
    { when: "Oct 2021", title: "Machine Learning with Python", from: "freeCodeCamp" },
    { when: "Oct 2021", title: "Data Analysis with Python", from: "freeCodeCamp" },
    { when: "Oct 2021", title: "Scientific Computing with Python", from: "freeCodeCamp" },
    { when: "Sep 2021", title: "Front End Development Libraries", from: "freeCodeCamp" },
    { when: "Sep 2021", title: "Data Visualization", from: "freeCodeCamp" },
    { when: "Sep 2021", title: "Back End Development and APIs", from: "freeCodeCamp" },
    { when: "Aug 2021", title: "JavaScript Algorithms and Data Structures", from: "freeCodeCamp" },
    { when: "Jul 2021", title: "Responsive Web Design", from: "freeCodeCamp" },
    { when: "2015", title: "BLS and ACLS certified", from: "American Heart Association" },
    { when: "2011", title: "BS in Biology, Cum Laude", from: "Middle Tennessee State University" },
];

// Arcade cabinets. `module` games are playable in the browser.
export const GAMES = [
    { id: "pirate", title: "Pirate Platformer", module: "../arcade/pirate/game.js", image: "images/pirategif.gif", about: "A pirate platformer with an overworld map and several levels. Originally Python and Pygame.", download: "Games/PiratePlatformer.zip" },
    { id: "flappy", title: "Flappy Bird Clone", module: "../arcade/flappy/game.js", image: "images/flappygif.gif", about: "My take on Flappy Bird. Originally Python and Pygame.", download: "Games/flappybird.zip" },
    { id: "spaceduel", title: "Space Duel", module: "../arcade/spaceduel/game.js", image: "images/spaceshipduelgif.gif", about: "A two-ship laser duel. Play a friend on one keyboard or the computer. Originally Python and Pygame.", download: "Games/SpaceshipDuel.zip" },
    { id: "pong", title: "Pong", module: "../arcade/pong/game.js", image: null, about: "The classic. First to 7 wins. Originally Python and Pygame.", download: "Games/pong.zip" },
    { id: "rpg", title: "Zelda-style RPG", module: null, image: "images/RPGgif.gif", about: "A top-down action RPG inspired by classic Zelda. Not playable here yet; ask me for a demo.", download: null },
];

// Science lab: data science and analytics projects.
export const LAB_PROJECTS = [
    { id: "covid", title: "Covid-19 Dashboard", tool: "Tableau", image: "images/Covid.png", url: "https://public.tableau.com/app/profile/jose.lobo6721/viz/CovidDashboard_16450346456260/Dashboard1" },
    { id: "movies", title: "Movie Data Correlation", tool: "Python, Jupyter", image: "images/moviedata.png", url: "https://github.com/jglobo/movie_correlation_project/blob/main/jupytercode/Movie%20Correlation%20Project.ipynb" },
    { id: "heatmap", title: "Education Heat Map", tool: "D3.js", image: "images/education.png", url: "https://codepen.io/Jglobo/pen/ExXwjLd" },
    { id: "tableau", title: "All my Tableau work", tool: "Tableau Public", image: null, url: "https://public.tableau.com/app/profile/jose.lobo6721" },
];

// Tech tower: apps.
export const TOWER_APPS = [
    { id: "studyclock", title: "Study Clock", tool: "JavaScript", image: "images/studyclock.png", url: "https://codepen.io/Jglobo/full/eYRgKQJ" },
    { id: "calculator", title: "iPhone Calculator Clone", tool: "JavaScript", image: "images/calculator.png", url: "https://codepen.io/Jglobo/full/mdwrgNx" },
    { id: "codepen", title: "More on CodePen", tool: "CodePen", image: null, url: "https://codepen.io/Jglobo" },
    { id: "github", title: "My GitHub", tool: "GitHub", image: null, url: "https://github.com/jglobo" },
];
