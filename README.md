# ✦ Pixel Vibes — Animated Pixel Worlds

**Where pixels come to life.**

Pixel Vibes is a personal creative hobby project dedicated to building immersive, animated pixel-art worlds using modern web technologies.

From peaceful countryside landscapes and rainy city streets to quiet gardens, mountain cabins, cars, and futuristic environments, every scene is an opportunity to explore a different atmosphere through code.

This project is built step by step, with new scenes, animations, visual experiments, and improvements added over time.

> A small creative world, built one pixel at a time.

---

## ✨ About the Project

Pixel Vibes is more than a collection of animated pages. It is an ongoing creative journey where programming meets pixel art, motion, atmosphere, and sound.

The main goal is to create beautiful interactive scenes that feel alive — using code to animate environments, simulate natural movement, and create immersive visual experiences.

This is an independent hobby project created for learning, experimentation, and personal growth as a frontend developer.

## 🎨 Vision & Features

* **Animated Pixel Worlds** — Explore different environments, themes, and atmospheres.
* **Procedural Visuals** — Experiment with scenes generated using JavaScript and HTML Canvas.
* **Natural Motion** — Simulate wind, moving clouds, falling rain, flowing water, and other environmental effects.
* **Ambient Soundscapes** — Add optional background music and environmental sounds to enhance the atmosphere.
* **Interactive Experiences** — Experiment with subtle interactions, parallax effects, and dynamic visual elements.
* **Multiple Themes** — Build unique environments, from peaceful nature scenes to atmospheric cities and futuristic worlds.
* **Continuous Development** — Add new scenes and improve existing ones as the project evolves.
* **Responsive Design** — Work toward a consistent experience across desktop and mobile devices.

*Features are planned and implemented progressively. Not every feature is available yet.*

## 🌌 Planned Worlds

Pixel Vibes is designed to grow into a collection of different animated environments.

| World                  | Description                                                    | Status  |
| ---------------------- | -------------------------------------------------------------- | ------- |
| 🌾 Farm & Countryside  | Moonlit fields, wheat moving in the wind, distant villages     | Planned |
| 🌃 City Life           | Atmospheric streets, glowing windows, traffic, and city lights | Planned |
| 🌿 Nature & Gardens    | Trees, flowers, flowing water, and peaceful outdoor scenes     | Planned |
| 🚗 Cars & Roads        | Pixel-art vehicles, night drives, and illuminated roads        | Planned |
| 🌧️ Rainy Environments | Rainfall, reflections, wet streets, and ambient sound          | Planned |
| 🏔️ Mountain Escapes   | Quiet cabins, distant mountains, and starry skies              | Planned |
| 🌆 Future Worlds       | Neon lights, futuristic cities, and experimental environments  | Planned |

*Scene statuses will be updated as development progresses.*

## 🛠️ Tech Stack

The project is being developed with a focus on frontend technologies and creative coding.

* **React** — Component-based architecture for building reusable scenes.
* **JavaScript (ES6+)** — Animation logic, interactions, and dynamic environments.
* **HTML5 Canvas** — Procedural pixel-art rendering and animated visual elements.
* **HTML5** — Application structure and document metadata.
* **SCSS / Sass** — Modular styling, variables, and reusable design patterns.
* **CSS3** — Layouts, transitions, and visual effects.
* **Vite** — Development server and frontend build tooling.
* **Web Audio API** — Optional ambient sound experiments.

Additional technologies may be introduced as the project grows.

## 📁 Project Structure

The project uses a modular structure to keep individual worlds organized and easy to maintain.

```text
pixel-vibes/
├── public/
│   ├── favicon.png
│   ├── logo.svg
│   └── sounds/
│
├── src/
│   ├── assets/
│   │   ├── images/
│   │   ├── audio/
│   │   └── fonts/
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Navbar.jsx
│   │   │   └── Footer.jsx
│   │   │
│   │   ├── farm-land/
│   │   │   ├── FarmLand.jsx
│   │   │   └── FarmLand.scss
│   │   │
│   │   ├── city/
│   │   │   ├── City.jsx
│   │   │   └── City.scss
│   │   │
│   │   ├── nature/
│   │   │   ├── Nature.jsx
│   │   │   └── Nature.scss
│   │   │
│   │   ├── cars/
│   │   │   ├── Cars.jsx
│   │   │   └── Cars.scss
│   │   │
│   │   └── shared/
│   │       ├── AudioControl.jsx
│   │       └── PixelCanvas.jsx
│   │
│   ├── pages/
│   │   ├── Home.jsx
│   │   └── Explore.jsx
│   │
│   ├── hooks/
│   ├── utils/
│   ├── styles/
│   │   ├── _variables.scss
│   │   ├── _mixins.scss
│   │   ├── _global.scss
│   │   └── main.scss
│   │
│   ├── App.jsx
│   └── main.jsx
│
├── .gitignore
├── index.html
├── package.json
├── vite.config.js
├── LICENSE
└── README.md
```

*This structure represents the planned architecture. Directories and files will be introduced as they become necessary.*

### Architecture Principles

* Each environment should have its own component and stylesheet.
* Shared UI elements should live in reusable components.
* Common colors, spacing, and design values should be centralized.
* Animation logic should remain organized and maintainable.
* New worlds should be possible to introduce without rewriting existing scenes.

## 🚀 Getting Started

### Prerequisites

* [Node.js](https://nodejs.org/) — a current supported LTS release.
* npm — included with Node.js.
* Git — for version control.

### Installation

**1. Clone the repository**

```bash
git clone https://github.com/TemurbekCode/Pixel-Vibes.git
```

**2. Navigate to the project directory**

```bash
cd pixelvibes
```

**3. Install dependencies**

```bash
npm install
```

**4. Start the development server**

```bash
npm run dev
```

**5. Open the local URL**

Vite will display the local development address in your terminal, usually:

```text
http://localhost:5173
```

> These instructions assume the repository uses Vite and the npm scripts shown above. Adjust the repository URL or commands if your setup differs.

## 🧭 Development Roadmap

Pixel Vibes will evolve gradually through small, manageable development milestones.

* [ ] Set up the initial React application and project structure.
* [ ] Establish the visual identity and global design system.
* [ ] Build the first animated pixel-art environment.
* [ ] Experiment with wind, stars, clouds, and atmospheric effects.
* [ ] Introduce optional ambient audio.
* [ ] Create a reusable architecture for additional scenes.
* [ ] Add city, nature, vehicle, and other themed environments.
* [ ] Improve responsiveness and performance.
* [ ] Add scene navigation and interactive controls.
* [ ] Publish a live demo.
* [ ] Continue expanding the collection with new creative experiments.

Progress will be reflected here as the project develops.

## 🎯 Project Goals

Pixel Vibes is an opportunity to:

* Improve React and JavaScript skills through practical experimentation.
* Explore creative coding and procedural animation.
* Develop a stronger understanding of Canvas rendering and animation loops.
* Practice component architecture and modular SCSS.
* Build a distinctive personal project over time.
* Learn through experimentation, iteration, and continuous improvement.

## 📸 Screenshots & Demo

Screenshots, animated previews, and a live demo will be added as the first environments become available.

The project is currently under active development.

## 🗺️ Future Direction

The long-term vision is to turn Pixel Vibes into a growing collection of immersive pixel-art experiences.

Each world will have its own visual identity, movement, lighting, and atmosphere while sharing a consistent creative spirit.

The project will continue to evolve as new ideas are explored and new scenes are built.

## 👨‍💻 Author

**Temurbek Alisherov** — Frontend Developer

* GitHub: [@TemurbekCode](https://github.com/TemurbekCode)

Pixel Vibes is a personal hobby project built with curiosity, creativity, and a passion for frontend development.

## 📄 License

This project is intended to use the MIT License. See the `LICENSE` file for the applicable terms once it has been added to the repository.

---

<p align="center">
  <i>Built with curiosity, creativity, and a love for pixels.</i>
  <br />
  <strong>Pixel Vibes — Animated Pixel Worlds ✦</strong>
</p>
