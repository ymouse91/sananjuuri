const WORDLIST_URL = "sanasto_max8.txt?v=22";
const STORAGE_KEY = "sanajuuri-state-v1";
const MIN_LENGTH = 3;
const MAX_LENGTH = 8;

const board = document.querySelector("#board");
const answerSlots = document.querySelector("#answer-slots");
const letterBank = document.querySelector("#letter-bank");
const message = document.querySelector("#message");
const stepLabel = document.querySelector("#step-label");
const scoreLabel = document.querySelector("#score-label");
const clearButton = document.querySelector("#clear-button");
const shuffleButton = document.querySelector("#shuffle-button");
const hintButton = document.querySelector("#hint-button");
const newGameButton = document.querySelector("#new-game-button");
const infoButton = document.querySelector("#info-button");
const infoDialog = document.querySelector("#info-dialog");
const closeInfo = document.querySelector("#close-info");

let words = [];
let wordSet = new Set();
let keyToWords = new Map();
let puzzle = [];
let currentStep = 1;
let pickedLetters = [];
let bankLetters = [];
let hintLevel = 0;
let guessCount = 0;
let hintCount = 0;

function signature(word) {
  return [...word].sort().join("");
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function addToMap(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

function predecessorKeys(key) {
  const keys = [];
  for (let i = 0; i < key.length; i += 1) {
    if (i > 0 && key[i] === key[i - 1]) continue;
    keys.push(key.slice(0, i) + key.slice(i + 1));
  }
  return keys;
}

function buildChainFrom(finalWord) {
  const chain = [finalWord];
  let key = signature(finalWord);

  for (let len = finalWord.length - 1; len >= MIN_LENGTH; len -= 1) {
    const candidates = shuffle(predecessorKeys(key))
      .flatMap((candidateKey) => keyToWords.get(candidateKey) ?? [])
      .filter((word) => word.length === len);

    if (!candidates.length) return null;
    const nextWord = candidates[Math.floor(Math.random() * candidates.length)];
    chain.unshift(nextWord);
    key = signature(nextWord);
  }

  return chain;
}

function createPuzzle() {
  const finals = shuffle(words.filter((word) => word.length === MAX_LENGTH));
  for (const finalWord of finals.slice(0, 1200)) {
    const chain = buildChainFrom(finalWord);
    if (chain && new Set(chain).size === chain.length) return chain;
  }
  throw new Error("Sanastosta ei löytynyt sopivaa ketjua.");
}

function extraLetter(previous, next) {
  const letters = [...next];
  for (const char of previous) {
    const index = letters.indexOf(char);
    if (index >= 0) letters.splice(index, 1);
  }
  return letters[0] ?? "";
}

function markRootLetters() {
  const root = currentStep >= puzzle.length ? puzzle[puzzle.length - 1] : puzzle[currentStep - 1];
  const counts = new Map();
  [...root].forEach((char) => counts.set(char, (counts.get(char) ?? 0) + 1));

  bankLetters = bankLetters.map((item) => {
    const count = counts.get(item.char) ?? 0;
    if (count > 0) {
      counts.set(item.char, count - 1);
      return { ...item, isRoot: true };
    }
    return { ...item, isRoot: false };
  });
}

function markHintAvailability() {
  const target = puzzle[currentStep];
  if (!target || hintLevel === 0) {
    bankLetters = bankLetters.map((item) => ({ ...item, isInactive: false }));
    return;
  }

  const counts = new Map();
  [...target].forEach((char) => counts.set(char, (counts.get(char) ?? 0) + 1));

  bankLetters = bankLetters.map((item) => {
    const count = counts.get(item.char) ?? 0;
    if (count > 0) {
      counts.set(item.char, count - 1);
      return { ...item, isInactive: false };
    }
    return { ...item, isInactive: true, picked: false };
  });

  pickedLetters = pickedLetters.filter((item) => {
    if (!bankLetters[item.bankIndex]?.isInactive) return true;
    bankLetters[item.bankIndex].picked = false;
    return false;
  });
}

function formatWord(word) {
  return word.toLocaleUpperCase("fi-FI");
}

function dictionaryUrl(word) {
  return `https://www.kielitoimistonsanakirja.fi/${encodeURIComponent(word)}`;
}

function finishedMessage() {
  const guessText = guessCount === 1 ? "1 arvaus" : `${guessCount} arvausta`;
  const hintText = hintCount === 1 ? "1 vihje" : `${hintCount} vihjettä`;
  const praise = hintCount === 0 ? " Loistavaa, ratkaisit ilman vihjeitä!" : "";
  return `Valmis! ${guessText}, ${hintText}.${praise}`;
}

function saveState() {
  if (!puzzle.length || !bankLetters.length) return;

  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    puzzle,
    currentStep,
    bankLetters,
    pickedLetters,
    hintLevel,
    guessCount,
    hintCount,
  }));
}

function restoreState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;

    const state = JSON.parse(raw);
    if (!Array.isArray(state.puzzle) || state.puzzle.length !== MAX_LENGTH - MIN_LENGTH + 1) return false;
    if (!Array.isArray(state.bankLetters) || state.bankLetters.length !== MAX_LENGTH) return false;
    if (!Number.isInteger(state.currentStep) || state.currentStep < 1 || state.currentStep > state.puzzle.length) return false;
    if (!state.puzzle.every((word, index) => typeof word === "string" && word.length === index + MIN_LENGTH && wordSet.has(word))) return false;

    puzzle = state.puzzle;
    currentStep = state.currentStep;
    bankLetters = state.bankLetters.map((item, index) => ({
      char: item.char,
      id: Number.isInteger(item.id) ? item.id : index,
      isRoot: Boolean(item.isRoot),
      picked: Boolean(item.picked),
      isInactive: Boolean(item.isInactive),
    }));
    pickedLetters = Array.isArray(state.pickedLetters)
      ? state.pickedLetters
          .filter((item) => Number.isInteger(item.bankIndex) && bankLetters[item.bankIndex])
          .map((item) => ({ ...bankLetters[item.bankIndex], bankIndex: item.bankIndex }))
      : [];
    hintLevel = Number.isInteger(state.hintLevel) ? state.hintLevel : 0;
    guessCount = Number.isInteger(state.guessCount) ? state.guessCount : 0;
    hintCount = Number.isInteger(state.hintCount) ? state.hintCount : 0;
    markRootLetters();
    markHintAvailability();
    render();
    setMessage(currentStep >= puzzle.length ? finishedMessage() : "Jatketaan tallennetusta kohdasta.", currentStep >= puzzle.length ? "ok" : "");
    saveState();
    return true;
  } catch {
    return false;
  }
}

function startNewGame() {
  puzzle = createPuzzle();
  guessCount = 0;
  hintCount = 0;
  bankLetters = shuffle([...puzzle[puzzle.length - 1]]).map((char, index) => ({
    char,
    id: index,
    isRoot: false,
    picked: false,
    isInactive: false,
  }));
  currentStep = 1;
  prepareStep();
  saveState();
}

function openDictionary(word) {
  const popup = window.open(
    dictionaryUrl(word),
    "sanajuuri-sanakirja",
    "popup=yes,width=420,height=640,left=80,top=80,resizable=yes,scrollbars=yes",
  );

  if (!popup) {
    setMessage("Salli ponnahdusikkuna, niin sanakirja avautuu erilliseen ikkunaan.", "warn");
  }
}

function setMessage(text, tone = "") {
  message.textContent = text;
  message.className = `message ${tone}`.trim();
}

function renderBoard() {
  board.replaceChildren();

  puzzle.forEach((word, index) => {
    const row = document.createElement("div");
    row.className = "word-row";
    row.setAttribute("aria-label", `${index + 1}. sana`);
    const tiles = document.createElement("div");
    tiles.className = "word-tiles";

    const visible = index === 0 || index < currentStep;
    [...word].forEach((char) => {
      const tile = document.createElement("div");
      tile.className = visible ? "tile solved" : "tile empty";
      tile.textContent = visible ? formatWord(char) : "";
      tiles.append(tile);
    });
    row.append(tiles);

    if (visible) {
      const link = document.createElement("a");
      link.className = "dictionary-link";
      link.href = dictionaryUrl(word);
      link.target = "sanajuuri-sanakirja";
      link.rel = "noopener noreferrer";
      link.textContent = "?";
      link.setAttribute("aria-label", `Tarkista sanan ${word} merkitys Kielitoimiston sanakirjasta`);
      link.addEventListener("click", (event) => {
        event.preventDefault();
        openDictionary(word);
      });
      row.append(link);
    }

    board.append(row);
  });
}

function renderAnswer() {
  answerSlots.replaceChildren();
  const targetLength = puzzle[currentStep]?.length ?? 0;

  for (let i = 0; i < targetLength; i += 1) {
    const slot = document.createElement("button");
    slot.className = "slot";
    slot.type = "button";
    slot.textContent = pickedLetters[i] ? formatWord(pickedLetters[i].char) : "";
    slot.disabled = !pickedLetters[i];
    slot.addEventListener("click", () => unpickLetter(i));
    answerSlots.append(slot);
  }
}

function renderBank() {
  letterBank.replaceChildren();

  bankLetters.forEach((item, index) => {
    const button = document.createElement("button");
    button.className = [
      "letter",
      item.isRoot ? "root-letter" : "",
      item.picked ? "selected" : "",
      item.isInactive ? "inactive" : "",
    ].filter(Boolean).join(" ");
    button.type = "button";
    button.textContent = formatWord(item.char);
    button.setAttribute("aria-pressed", item.picked ? "true" : "false");
    button.setAttribute("aria-disabled", item.isInactive ? "true" : "false");
    button.addEventListener("click", () => pickLetter(index));
    letterBank.append(button);
  });
}

function renderStatus() {
  const solved = Math.max(0, currentStep);
  scoreLabel.textContent = `${solved}/${puzzle.length}`;

  if (currentStep >= puzzle.length) {
    stepLabel.textContent = "Valmis";
    return;
  }

  stepLabel.textContent = `Muodosta ${puzzle[currentStep].length}-kirjaiminen sana`;
}

function render() {
  renderBoard();
  renderAnswer();
  renderBank();
  renderStatus();
  hintButton.disabled = currentStep >= puzzle.length;
  clearButton.disabled = currentStep >= puzzle.length || pickedLetters.length === 0;
  shuffleButton.disabled = currentStep >= puzzle.length;
  newGameButton.disabled = !words.length;
}

function prepareStep() {
  if (currentStep >= puzzle.length) {
    setMessage(finishedMessage(), "ok");
    render();
    saveState();
    return;
  }

  const previous = puzzle[currentStep - 1];
  bankLetters = bankLetters.map((item) => ({ ...item, picked: false, isInactive: false }));
  markRootLetters(previous);
  pickedLetters = [];
  hintLevel = 0;
  setMessage("Vihreät kirjaimet ovat jo sanajuuressa.");
  render();
  saveState();
}

function pickLetter(index) {
  if (bankLetters[index].isInactive) return;

  if (bankLetters[index].picked) {
    const slotIndex = pickedLetters.findIndex((item) => item.bankIndex === index);
    if (slotIndex >= 0) unpickLetter(slotIndex);
    return;
  }

  bankLetters[index].picked = true;
  pickedLetters.push({ ...bankLetters[index], bankIndex: index });

  if (pickedLetters.length === puzzle[currentStep].length) {
    checkAnswer();
  } else {
    render();
    saveState();
  }
}

function unpickLetter(slotIndex) {
  const [item] = pickedLetters.splice(slotIndex, 1);
  if (item) bankLetters[item.bankIndex].picked = false;
  setMessage("");
  render();
  saveState();
}

function clearAnswer() {
  pickedLetters.forEach((item) => {
    bankLetters[item.bankIndex].picked = false;
  });
  pickedLetters = [];
  setMessage("");
  render();
  saveState();
}

function checkAnswer() {
  guessCount += 1;
  const guess = pickedLetters.map((item) => item.char).join("");
  const target = puzzle[currentStep];

  if (signature(guess) === signature(target) && wordSet.has(guess)) {
    puzzle[currentStep] = guess;
    currentStep += 1;
    prepareStep();
    return;
  }

  if (wordSet.has(guess)) {
    setMessage("Sana löytyy listasta, mutta kirjaimet eivät täsmää.", "warn");
  } else {
    setMessage("Tätä sanaa ei ole sanalistassa.", "warn");
  }
  render();
  saveState();
}

function useHint() {
  if (currentStep >= puzzle.length) return;
  const previous = puzzle[currentStep - 1];
  const target = puzzle[currentStep];
  const isFinalWord = currentStep === puzzle.length - 1;

  if (hintLevel === 0 && isFinalWord) {
    hintLevel = 2;
    hintCount += 1;
    markHintAvailability();
    setMessage(`Sana alkaa kirjaimella ${formatWord(target[0])}.`);
  } else if (hintLevel === 0) {
    hintLevel = 1;
    hintCount += 1;
    markHintAvailability();
    setMessage(`Uusi kirjain on ${formatWord(extraLetter(previous, target))}.`);
  } else if (hintLevel === 1) {
    hintLevel = 2;
    hintCount += 1;
    markHintAvailability();
    setMessage(`Sana alkaa kirjaimella ${formatWord(target[0])}.`);
  } else {
    setMessage(`Sana alkaa kirjaimella ${formatWord(target[0])}.`);
  }
  render();
  saveState();
}

function shuffleBank() {
  bankLetters = shuffle(bankLetters).map((item) => ({ ...item, picked: false, isInactive: false }));
  pickedLetters = [];
  markRootLetters();
  markHintAvailability();
  setMessage("Kirjaimet sekoitettu.");
  render();
  saveState();
}

async function boot() {
  try {
    const response = await fetch(WORDLIST_URL);
    if (!response.ok) throw new Error(`Sanaston lataus epäonnistui: ${response.status}`);

    words = (await response.text())
      .split(/\r?\n/)
      .map((word) => word.trim().toLocaleLowerCase("fi-FI"))
      .filter((word) => word.length >= MIN_LENGTH && word.length <= MAX_LENGTH);

    wordSet = new Set(words);
    keyToWords = new Map();
    words.forEach((word) => addToMap(keyToWords, signature(word), word));

    if (!restoreState()) startNewGame();
  } catch (error) {
    stepLabel.textContent = "Sanastoa ei voitu ladata";
    setMessage(error.message, "warn");
  }
}

newGameButton.addEventListener("click", startNewGame);
clearButton.addEventListener("click", clearAnswer);
shuffleButton.addEventListener("click", shuffleBank);
hintButton.addEventListener("click", useHint);
infoButton.addEventListener("click", () => infoDialog.showModal());
closeInfo.addEventListener("click", () => infoDialog.close());

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      setMessage("Offline-tilan käyttöönotto epäonnistui.", "warn");
    });
  });
}

boot();
