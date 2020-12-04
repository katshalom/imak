"use strict";

function isNumber(n) {
  return typeof n === "number" ? !isNaN(n) : false;
}

function subscribeEvent(element, event, handler) {
  element.addEventListener(event, handler);
  return {
    cancel() {
      element.removeEventListener(event, handler);
    }
  }
}

function singleEvent(element, event, handler) {
  let wrappedHandler = (...args) => {
    element.removeEventListener(event, wrappedHandler);
    handler(...args);
  }
  element.addEventListener(event, wrappedHandler);
}

function swapTransform(a, b) {
  let at = a.style.transform;
  a.style.transform = b.style.transform;
  b.style.transform = at;
}

let backgrounds = [].concat(...[...document.styleSheets]
    .map(e => [...e.cssRules]))
    .filter(e => e instanceof CSSStyleRule)
    .map(e => e.style.getPropertyValue("background-image"))
    .filter(e => !!e && e.startsWith("url("))
    .map(e => new Image().src = JSON.parse(e.replace(/^url\(|\)$/g, "")));

[...document.querySelectorAll(".card")].forEach(e => {
  while (e.firstChild.nodeType === Node.TEXT_NODE) e.removeChild(e.firstChild);
  let lines = e.firstChild.textContent.trim().split("\n").map(e => e.trim()).filter(e => e);
  let first = true;
  let additional = document.createDocumentFragment();
  let current = e;
  let slides = [];
  for (let line of lines) {
    if (!first) {
      current = current.cloneNode(true);
      additional.appendChild(current);
    } else {
      first = false;
    }
    current.firstChild.textContent = line;
    slides.push(current);
  }
  e.parentNode.appendChild(additional);
});

function Prayer(element) {
  this.element = element;
  this.element.addEventListener("transitionend", e => {
    if (e.target === this.element)
      this._finishTransition();
  });
  this._id = this.element.getAttribute("data-id");
  this._title = this.element.getAttribute("data-title");
}

Prayer.prototype = {

  get id() {
    return this._id;
  },

  get title() {
    return this._title;
  },

  _finishTransition() {
    this.element.classList.remove("transitioning");
    this.element.style.display = "";
    this.element.style.zIndex = "";
  },

  hide() {
    this.element.classList.add("transitioning");
    this.element.style.zIndex = 1;
    this.element.style.opacity = 0;
  },

  show() {
    this.element.style.opacity = 1;
    this.element.style.display = "block";
  },

  next(delta) {
    if (!isNumber(delta)) delta = 1;
    let newIndex = Math.max(Math.min(this.cardIndex + delta,
      this.cards.length+1), -1);
    if (newIndex > this.cards.length) {
      return false;
    } else {
      this.cardIndex = newIndex;
      return true;
    }
  },

  reset() {
    this.cards.forEach((e, i) => e.style.opacity = 0);
    this.cardIndex = -1;
    document.title = this.element.getAttribute("data-title");
  },

  _cardOpacity(index, opacity) {
    let card = this.cards[index];
    if (card) card.style.opacity = opacity;
  },

  /**
   * @param {number} i
   */
  set cardIndex(i) {
    if (isNumber(this._cardIndex)) {
      this._cardOpacity(this._cardIndex, 0);
    }
    this._cardIndex = i;
    this._cardOpacity(this._cardIndex, 1);
  },

  get cardIndex() {
    return this._cardIndex;
  },

  get cards() {
    if (!this._cards) {
      this._cards = [...this.element.querySelectorAll(".card")];
    }
    return this._cards;
  }
}

let prayerList = [...document.querySelectorAll("[data-id]")].map(e => new Prayer(e));
let prayers = Object.fromEntries(prayerList.map(e => [e.id, e]));
let currentPrayer = null;

function startPrayer(id) {
  if (currentPrayer) currentPrayer.hide();
  currentPrayer = prayers[id];
  if (currentPrayer) {
    currentPrayer.reset();
    currentPrayer.show();
  }
}

let selectedPrayers = (new URL(location.toString()).searchParams.get("p") || "").split(/[-\.,;]/g).filter(e => prayers[e]);
let selectedPrayerIndex = 0;

if (selectedPrayers.length === 0) {
  document.body.classList.add("setup");
  let list = document.querySelector("div.setup ul.list");
  let items = [];
  prayerList.map(p => {
    let item = document.createElement("li");
    item.classList.add("item");
    item.setAttribute("data-pid", p.id);
    item.textContent = p.title;
    list.appendChild(item);
    items.push(item);
  });
  setTimeout(() => {
    items.forEach(item => {
      item.addEventListener("mousedown", e => {
        e.preventDefault();
        let downTime = Date.now();
        let downY = e.clientY;
        let subscription = subscribeEvent(document, "mousemove", e => {
          let cy = e.clientY;
          while (true) {
            let delta = (cy - downY)/item.offsetHeight|0;
            if (delta) {
              let index = items.findIndex(e => e === item);
              if (delta < 0 && index <= 0) return;
              if (delta > 0 && index >= items.length) return;
              if (delta < 0) {
                downY -= item.offsetHeight;
                swapTransform(items[index-1], items[index]);
                let s = items[index-1];
                items[index-1] = items[index];
                items[index] = s;
              } else if (delta > 0) {
                downY += item.offsetHeight;
                swapTransform(items[index+1], items[index]);
                let s = items[index+1];
                items[index+1] = items[index];
                items[index] = s;
              }
            } else {
              return;
            }
          }
        });
        singleEvent(document, "mouseup", e => {
          subscription.cancel();
          let time = Date.now() - downTime;
          if (time < 300) {
            item.classList.toggle("selected");
          }
        });
      });
    });
    list.style.width = list.offsetWidth+1+"px";
    list.style.height = list.offsetHeight+1+"px";
    for (let item of items) {
      item.style.transform = "translate(0px, "+item.offsetTop+"px)";
      item.style.width = item.offsetWidth+1+"px";
      item.style.height = item.offsetHeight+1+"px";
    }
    list.classList.add("rigged");
    document.querySelector("div.setup button").addEventListener("click", e => {
      let target = new URL(location.toString());
      target.searchParams.set("p", items
        .filter(e => e.classList.contains("selected"))
        .map(e => e.getAttribute("data-pid"))
        .join("-"));
      window.open(target.toString(), "prayerView");
    });
  }, 100);
} else {
  startPrayer(selectedPrayers[selectedPrayerIndex]);

  function step(delta) {
    if (currentPrayer && !currentPrayer.next(delta) && !isNumber(delta)) {
      ++selectedPrayerIndex;
      let prayer = selectedPrayers[selectedPrayerIndex];
      if (prayer) {
        startPrayer(prayer);
      }
    }
  }

  document.addEventListener("click", _ => {
    step();
  });

  document.addEventListener("keyup", e => {
    if (e.key === " " || e.key === "Enter") step();
    if (e.key === "ArrowLeft" || e.key === "ArrowRight")
      step(e.key === "ArrowLeft" ? -1 : 1)
  });
}
