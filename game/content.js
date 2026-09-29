// Everything the island shows lives here, so updating the portfolio
// means editing this file only. Image paths are relative to the site root.

export const CONTACT_EMAIL = "jgl2j@yahoo.com";

export const CARDS = {
    about: {
        tag: "Home",
        title: "Hi, I'm Jose Lobo",
        prompt: "About Jose",
        image: "images/portphoto.jpg",
        body: [
            "I'm a self-taught software developer and a Business Intelligence Analyst II at Envision Healthcare, where I use SQL, Python and some R to turn claims data into insight for leadership.",
            "I love building things that are engaging and fun, especially games. This island is my portfolio: walk around to find my games, apps and data projects.",
        ],
        stats: [
            ["50+", "Projects"],
            ["6+", "Languages & frameworks"],
            ["5", "BI tools"],
            ["8", "Certifications"],
        ],
        links: [{ label: "Download resume (PDF)", href: "Jose_Lobo_pdf_Resume.pdf", download: true }],
    },

    pirate: {
        tag: "Arcade · Python / Pygame",
        title: "Pirate Platformer",
        image: "images/pirategif.gif",
        body: ["A pirate platformer built in Python with Pygame."],
        links: [{ label: "Download demo (.zip)", href: "Games/PiratePlatformer.zip", download: true }],
    },
    flappy: {
        tag: "Arcade · Python / Pygame",
        title: "Flappy Bird Clone",
        image: "images/flappygif.gif",
        body: ["My take on Flappy Bird, built in Python with Pygame."],
        links: [{ label: "Download demo (.zip)", href: "Games/flappybird.zip", download: true }],
    },
    spaceduel: {
        tag: "Arcade · Python / Pygame",
        title: "Space Duel",
        image: "images/spaceshipduelgif.gif",
        body: ["A spaceship duel game built in Python with Pygame."],
        links: [{ label: "Download demo (.zip)", href: "Games/SpaceshipDuel.zip", download: true }],
    },
    rpg: {
        tag: "Arcade · Python / Pygame",
        title: "Zelda-style RPG",
        image: "images/RPGgif.gif",
        body: ["An RPG inspired by classic Zelda, built in Python with Pygame. The demo is available on request."],
        links: [{ label: "Ask for a demo", href: `mailto:${CONTACT_EMAIL}?subject=RPG%20demo` }],
    },

    studyclock: {
        tag: "Workshop · CodePen",
        title: "Study Clock",
        image: "images/studyclock.png",
        body: ["A study timer app, built on CodePen."],
        links: [{ label: "Open on CodePen", href: "https://codepen.io/Jglobo/full/eYRgKQJ" }],
    },
    calculator: {
        tag: "Workshop · CodePen",
        title: "iPhone Calculator Clone",
        image: "images/calculator.png",
        body: ["A clone of the iPhone calculator, built on CodePen."],
        links: [{ label: "Open on CodePen", href: "https://codepen.io/Jglobo/full/mdwrgNx" }],
    },
    heatmap: {
        tag: "Workshop · CodePen",
        title: "Education Heat Map",
        image: "images/education.png",
        body: ["A heat map of education data, built on CodePen."],
        links: [{ label: "Open on CodePen", href: "https://codepen.io/Jglobo/pen/ExXwjLd" }],
    },

    covid: {
        tag: "Gallery · Tableau",
        title: "Covid-19 Dashboard",
        image: "images/Covid.png",
        body: ["A Covid-19 data dashboard built in Tableau."],
        links: [
            { label: "View dashboard", href: "https://public.tableau.com/app/profile/jose.lobo6721/viz/CovidDashboard_16450346456260/Dashboard1" },
            { label: "All Tableau work", href: "https://public.tableau.com/app/profile/jose.lobo6721" },
        ],
    },
    movies: {
        tag: "Gallery · Python / Jupyter",
        title: "Movie Data Correlation",
        image: "images/moviedata.png",
        body: ["A movie data correlation analysis in a Jupyter notebook."],
        links: [{ label: "View notebook", href: "https://github.com/jglobo/movie_correlation_project/blob/main/jupytercode/Movie%20Correlation%20Project.ipynb" }],
    },

    skills: {
        tag: "Training Yard",
        title: "Skills & Certifications",
        body: ["I'm also comfortable with HTML, CSS and several other frameworks."],
        skills: [
            ["JavaScript", 75],
            ["Python", 75],
            ["SQL", 75],
            ["C++", 35],
        ],
        links: [{ label: "freeCodeCamp certifications", href: "https://www.freecodecamp.org/fccf4c3a239-3f0e-4397-8d3b-77345a7aadea" }],
    },

    contact: {
        tag: "Mailbox",
        title: "Get in touch",
        body: [
            "If you think I'd be a good fit for your team, or you'd like to work on a project together, send me a message.",
            "I learned to program in the summer of 2021, completed medical education at UMHS in 2017 and graduated from MTSU in 2011.",
        ],
        links: [
            { label: "Email me", href: `mailto:${CONTACT_EMAIL}` },
            { label: "LinkedIn", href: "https://www.linkedin.com/in/jose-lobo-66591b140/" },
            { label: "GitHub", href: "https://github.com/jglobo" },
            { label: "CodePen", href: "https://codepen.io/Jglobo" },
        ],
    },
};

// Where each area sits on the island (x, z) and which cards it holds.
// Areas face the island centre, so "left to right" is as seen on approach.
export const AREAS = [
    { id: "home", label: "Home", pos: [0, -24], cards: ["about"] },
    { id: "arcade", label: "Arcade", pos: [25, -7], cards: ["pirate", "flappy", "spaceduel", "rpg"] },
    { id: "workshop", label: "Workshop", pos: [16, 21], cards: ["studyclock", "calculator", "heatmap"] },
    { id: "gallery", label: "Data Gallery", pos: [-16, 21], cards: ["covid", "movies"] },
    { id: "yard", label: "Training Yard", pos: [-25, -7], cards: ["skills"] },
    { id: "mailbox", label: "Contact", pos: [-7, -10], cards: ["contact"] },
];

// Screen images for the 3D props; the cards show the animated GIFs instead,
// loaded only when opened, so the island itself stays light.
export const PROP_IMAGES = {
    pirate: "images/pirate.png",
    flappy: "images/flappy.png",
    spaceduel: "images/spaceduel.png",
    rpg: null,
    studyclock: "images/studyclock.png",
    calculator: "images/calculator.png",
    heatmap: "images/education.png",
    covid: "images/Covid.png",
    movies: "images/moviedata.png",
    about: "images/portphoto2.jpg",
};
