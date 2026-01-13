import fs from 'fs';
import TelegramBot from 'node-telegram-bot-api';
import willhaben from 'willhaben';

// === 🔐 Telegram бот ===
const TELEGRAM_TOKEN = "8252768039:AAFEMKMIIxBXpUUPIPi1VJsah1W7sHnX_ug";
const CHAT_ID = "-5067560840";

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

bot.on("error", (error) => console.error("Telegram bot error:", error.message));
bot.on("polling_error", async (error) => {
  console.error("Polling error:", error.message);

  if (error.code === "EFATAL") {
    console.warn("🔄 Restarting Telegram polling...");
    try {
      await bot.stopPolling();
    } catch {}

    setTimeout(() => {
      bot.startPolling();
    }, 5000);
  }
});

async function sendTelegramMessage(text) {
  try {
    await bot.sendMessage(CHAT_ID, text, { parse_mode: "HTML" });
  } catch (err) {
    console.error("Telegram send error:", err.message);
  }
}

// === 💤 Sleep ===
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const mainboards = [
  "B350",
  "B450",
  "B550",
  "X370",
  "X470",
  "X570",
  "A320",
  "A520",
].map((model) => ({
  name: model,
  keyword: model,
  category: willhaben.getCategories.mainboards,
  file: `known_${model}.json`,
}));

// === 📌 Налаштування пошуків ===
const SEARCH_TASKS = [
  {
    name: "3060",
    keyword: "ddr4",
    category: willhaben.getCategories["ram-speicher-arbeitsspeicher"],
    file: "known_ddr4.json",
  },
  {
    name: "3060",
    keyword: "Rx 6700",
    category: willhaben.getCategories.grafikkarten,
    file: "known_rx_6700.json",
  },
  {
    name: "3060",
    keyword: "Rx 6600",
    category: willhaben.getCategories.grafikkarten,
    file: "known_rx_6600.json",
  },
  {
    name: "3060",
    keyword: "7 5800",
    category: willhaben.getCategories["cpus-prozessoren"],
    file: "known_7_5800.json",
  },
  {
    name: "3060",
    keyword: "7 5700",
    category: willhaben.getCategories["cpus-prozessoren"],
    file: "known_7_5700.json",
  },
  {
    name: "3060",
    keyword: "5 5600",
    category: willhaben.getCategories["cpus-prozessoren"],
    file: "known_5_5600.json",
  },
  {
    name: "3060",
    keyword: "5 3600",
    category: willhaben.getCategories["cpus-prozessoren"],
    file: "known_5_3600.json",
  },
  {
    name: "3060",
    keyword: "",
    category: willhaben.getCategories.netzteile,
    file: "known_netzteile.json",
  },
  {
    name: "3060",
    keyword: "2080",
    category: willhaben.getCategories.grafikkarten,
    file: "known_2080.json",
  },
  {
    name: "3060",
    keyword: "2070",
    category: willhaben.getCategories.grafikkarten,
    file: "known_2070.json",
  },
  {
    name: "3060",
    keyword: "2060",
    category: willhaben.getCategories.grafikkarten,
    file: "known_2060.json",
  },
  {
    name: "3060",
    keyword: "3060",
    category: willhaben.getCategories.grafikkarten,
    file: "known_3060.json",
  },
  {
    name: "3070",
    keyword: "3070",
    category: willhaben.getCategories.grafikkarten,
    file: "known_3070.json",
  },
  {
    name: "3080",
    keyword: "3080",
    category: willhaben.getCategories.grafikkarten,
    file: "known_3080.json",
  },
  ...mainboards, // ВСІ МАТЕРИНКИ
  {
    name: "gehause",
    keyword: "",
    category: willhaben.getCategories.gehaeuse,
    file: "known_gehaeuse.json",
  },
  {
    name: "Kühler",
    keyword: "",
    category: willhaben.getCategories["luefter-kuehlung"],
    file: "known_kuhler.json",
  },
];

/*Додати Мат.плати
B350 15-20€
B450 15-25€
B550 25-40 €
X370 20-30€
X470 20-35€
X570 30-50€
A320 10-15€
A520 10-25€

І додати фільтр пошуку 
Kühler (кулери)
По можливості таймінг оновлення зробити трохи менше
*/

// === 🧹 Очищення known-файлів при запуску ===
for (const task of SEARCH_TASKS) {
  try {
    fs.writeFileSync(task.file, JSON.stringify([], null, 2));
    console.log(`✔ Почистив базу: ${task.file}`);
  } catch (err) {
    console.error(`Помилка очищення ${task.file}:`, err.message);
  }
}

// === 🧠 Флаг першого циклу для всіх задач ===
let isFirstCycle = true;

async function safeWillhabenSearch(builder, retries = 5) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await builder.search();
    } catch (err) {
      const retryable =
        err.code === "ECONNRESET" ||
        err.code === "ETIMEDOUT" ||
        err.type === "system" ||
        err instanceof SyntaxError || // 🔥 ОЦЕ ГОЛОВНЕ
        err.message?.includes("JSON");

      if (!retryable || attempt === retries) {
        throw err;
      }

      console.warn(
        `⚠ Willhaben error (${attempt}/${retries}): ${err.message} → retry`
      );
      await sleep(3000 * attempt);
    }
  }
}

// === 🔍 Функція моніторингу однієї задачі ===
async function monitorTask(task) {
  const { name, keyword, category, file } = task;
  console.log(`Monitoring ${name}...`, new Date().toISOString());

  try {
    let results;
    try {
      results = await safeWillhabenSearch(
        willhaben.new().keyword(keyword).category(category).count(5)
      );
    } catch (err) {
      console.error(`Willhaben failed (${name}):`, err.message);
      return;
    }

    if (!Array.isArray(results)) {
      console.error(`Помилка: результати для ${name} не масив`);
      return;
    }

    const listings = results.map((item) => ({
      id: item.adid || item.id,
      title: item.heading,
      price: item.price_for_display,
      location: item.location,
      url: `https://www.willhaben.at/iad/${item.seo_url}`,
      date: item.published_string,
    }));

    // === 📘 Читаємо наявні відомі оголошення (завжди пусті на старті) ===
    let known = [];
    try {
      if (fs.existsSync(file)) {
        const raw = fs.readFileSync(file, "utf8").trim();

        if (!raw) {
          known = [];
        } else {
          known = JSON.parse(raw);
        }
      }
    } catch (fileErr) {
      console.error(`Помилка читання ${file}:`, fileErr.message);
    }

    const knownIds = new Set(known.map((x) => x.id));
    const newListings = listings.filter((x) => !knownIds.has(x.id));

    // === 🛑 Перший цикл: НЕ надсилати нічого ===
    if (isFirstCycle) {
      console.log(`Перший цикл (${name}) → Пропускаємо надсилання`);
      fs.writeFileSync(file, JSON.stringify(listings, null, 2));
      return;
    }

    // === ✉️ Надсилаємо нові оголошення ===
    if (newListings.length > 0) {
      console.log(`Нові оголошення (${name}): ${newListings.length}`);

      for (const ad of newListings) {
        const msg = `
<b>📢 Нове оголошення (${name})</b>

<b>${ad.title}</b>
💰 ${ad.price}
📍 ${ad.location}
🕓 ${ad.date}

🔗 <a href="${ad.url}">Переглянути</a>
        `;

        try {
          await sendTelegramMessage(msg);
        } catch (err) {
          console.error("Помилка відправки:", err.message);
        }
      }
    }

    // === 💾 Оновлюємо known-файл ===
    fs.writeFileSync(file, JSON.stringify([...known, ...newListings], null, 2));
  } catch (err) {
    console.error(`❌ ${name} error:`, err.message);

    // ❗ не даємо впасти циклу
    await sleep(3000);
    return;
  }
}

// === 🚀 Головний цикл ===
(async () => {
  console.log("=== Мульти-моніторинг запущено ===");

  while (true) {
    for (const task of SEARCH_TASKS) {
      await monitorTask(task);
      await sleep(2500);
    }

    // 🔄 Після першого повного циклу → починаємо надсилати
    if (isFirstCycle) {
      console.log(
        "✔ Перший цикл завершено — тепер сповіщення будуть надсилатися"
      );
      isFirstCycle = false;
    }

    await sleep(5 * 60 * 1000);
  }
})();

// === 🛡️ Обробка глобальних помилок ===
process.on('unhandledRejection', (reason) => {
  console.error('🔥 UNHANDLED FULL:', reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  // Не завершуємо процес, просто логуємо
});
