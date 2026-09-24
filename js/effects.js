/* ==========================================
   PROJOYSTICK — GLARE HOVER
========================================== */

function createGlareHover(element, options = {}) {

    if (!element) return;

    const {
        glareColor = "#ffffff",
        glareOpacity = 0.3,
        glareAngle = -30,
        glareSize = 300,
        transitionDuration = 800,
        playOnce = false
    } = options;


    /* Convert HEX → RGBA */
    function hexToRgba(hex, opacity) {

        hex = hex.replace("#", "");

        if (hex.length === 3) {
            hex = hex
                .split("")
                .map(char => char + char)
                .join("");
        }

        if (hex.length !== 6) {
            return `rgba(255,255,255,${opacity})`;
        }

        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);

        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }


    element.style.setProperty(
        "--gh-rgba",
        hexToRgba(glareColor, glareOpacity)
    );

    element.style.setProperty(
        "--gh-angle",
        `${glareAngle}deg`
    );

    element.style.setProperty(
        "--gh-size",
        `${glareSize}%`
    );

    element.style.setProperty(
        "--gh-duration",
        `${transitionDuration}ms`
    );


    if (playOnce) {
        element.classList.add("glare-hover--play-once");
    }
}


/* ==========================================
   PROJOYSTICK — SHINY TEXT EFFECT
   Vanilla JS version
========================================== */

class ShinyText {

    constructor(element, options = {}) {

        if (!element) {
            return;
        }

        this.element = element;

        this.text = options.text ?? element.textContent.trim();

        this.disabled =
            options.disabled ?? false;

        this.speed =
            options.speed ?? 2;

        this.color =
            options.color ?? "#b5b5b5";

        this.shineColor =
            options.shineColor ?? "#ffffff";

        this.spread =
            options.spread ?? 120;

        this.yoyo =
            options.yoyo ?? false;

        this.pauseOnHover =
            options.pauseOnHover ?? false;

        this.direction =
            options.direction ?? "left";

        this.delay =
            options.delay ?? 0;

        this.progress = 0;

        this.elapsed = 0;

        this.lastTime = null;

        this.paused = false;

        this.directionValue =
            this.direction === "left" ? 1 : -1;

        this.animationFrame = null;

        this.setup();

        this.bindEvents();

        this.animate();
    }


    /* ======================================
       SETUP
    ====================================== */

    setup() {

        this.element.classList.add("shiny-text");

        this.element.textContent = this.text;

        this.element.style.backgroundImage =
            `linear-gradient(
                ${this.spread}deg,
                ${this.color} 0%,
                ${this.color} 35%,
                ${this.shineColor} 50%,
                ${this.color} 65%,
                ${this.color} 100%
            )`;

        this.element.style.backgroundSize =
            "200% auto";

        this.element.style.webkitBackgroundClip =
            "text";

        this.element.style.backgroundClip =
            "text";

        this.element.style.webkitTextFillColor =
            "transparent";

        this.element.style.color =
            "transparent";
    }


    /* ======================================
       EVENTS
    ====================================== */

    bindEvents() {

        if (!this.pauseOnHover) {
            return;
        }

        this.element.addEventListener(
            "mouseenter",
            () => {
                this.paused = true;
                this.lastTime = null;
            }
        );

        this.element.addEventListener(
            "mouseleave",
            () => {
                this.paused = false;
                this.lastTime = null;
            }
        );
    }


    /* ======================================
       ANIMATION
    ====================================== */

    animate(time = 0) {

        if (!this.disabled && !this.paused) {

            if (this.lastTime === null) {

                this.lastTime = time;

            } else {

                const delta =
                    time - this.lastTime;

                this.lastTime = time;

                this.elapsed += delta;

                this.update();
            }
        }

        this.animationFrame =
            requestAnimationFrame(
                this.animate.bind(this)
            );
    }


    /* ======================================
       UPDATE
    ====================================== */

    update() {

        const animationDuration =
            Math.max(this.speed, 0.01) * 1000;

        const delayDuration =
            Math.max(this.delay, 0) * 1000;


        /* ==================================
           YOYO MODE
        ================================== */

        if (this.yoyo) {

            const cycleDuration =
                animationDuration +
                delayDuration;

            const fullCycle =
                cycleDuration * 2;

            const cycleTime =
                this.elapsed % fullCycle;


            if (cycleTime < animationDuration) {

                const p =
                    (cycleTime /
                        animationDuration) *
                    100;

                this.progress =
                    this.directionValue === 1
                        ? p
                        : 100 - p;

            }

            else if (cycleTime < cycleDuration) {

                this.progress =
                    this.directionValue === 1
                        ? 100
                        : 0;

            }

            else if (
                cycleTime <
                cycleDuration +
                animationDuration
            ) {

                const reverseTime =
                    cycleTime -
                    cycleDuration;

                const p =
                    100 -
                    (reverseTime /
                        animationDuration) *
                    100;

                this.progress =
                    this.directionValue === 1
                        ? p
                        : 100 - p;

            }

            else {

                this.progress =
                    this.directionValue === 1
                        ? 0
                        : 100;
            }
        }


        /* ==================================
           NORMAL MODE
        ================================== */

        else {

            const cycleDuration =
                animationDuration +
                delayDuration;

            const cycleTime =
                this.elapsed %
                cycleDuration;


            if (
                cycleTime <
                animationDuration
            ) {

                const p =
                    (cycleTime /
                        animationDuration) *
                    100;

                this.progress =
                    this.directionValue === 1
                        ? p
                        : 100 - p;

            }

            else {

                this.progress =
                    this.directionValue === 1
                        ? 100
                        : 0;
            }
        }


        this.render();
    }


    /* ======================================
       RENDER
    ====================================== */

    render() {

        const backgroundPosition =
            `${150 - this.progress * 2}% center`;

        this.element.style.backgroundPosition =
            backgroundPosition;
    }


    /* ======================================
       DESTROY
    ====================================== */

    destroy() {

        if (this.animationFrame) {

            cancelAnimationFrame(
                this.animationFrame
            );

            this.animationFrame = null;
        }
    }
}


/* ==========================================
   AUTO INITIALIZE
========================================== */

window.ShinyText = ShinyText;


document.addEventListener(
    "DOMContentLoaded",
    () => {

        document
            .querySelectorAll("[data-shiny-text]")
            .forEach(element => {

                new ShinyText(element, {

                    text:
                        element.dataset.shinyText ||
                        element.textContent.trim(),

                    speed:
                        Number(
                            element.dataset.speed ||
                            2
                        ),

                    delay:
                        Number(
                            element.dataset.delay ||
                            0
                        ),

                    color:
                        element.dataset.color ||
                        "#b5b5b5",

                    shineColor:
                        element.dataset.shineColor ||
                        "#ffffff",

                    spread:
                        Number(
                            element.dataset.spread ||
                            120
                        ),

                    direction:
                        element.dataset.direction ||
                        "left",

                    yoyo:
                        element.dataset.yoyo === "true",

                    pauseOnHover:
                        element.dataset.pauseOnHover === "true",

                    disabled:
                        element.dataset.disabled === "true"
                });
            });
    }
);