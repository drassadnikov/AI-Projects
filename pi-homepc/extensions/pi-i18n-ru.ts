/**
 * pi-i18n-ru.ts — Русификация TUI pi (pi.dev) на русском языке.
 *
 * Как работает (v2, 2026-11-13)
 * -----------------------------
 * 1. Патчит `Theme.prototype.fg/bg/bold/italic/underline/inverse/strikethrough/style`
 *    (класс Theme импортируется из @earendil-works/pi-coding-agent — в API `pi`
 *    класса нет, поэтому берём напрямую): все строки, проходящие через тему
 *    (включая описание настроек в /settings), прогоняются через словарь RUS.
 * 2. Патчит `SelectList.prototype.render` и `SettingsList.prototype.renderMainList`
 *    (импорт из @earendil-works/pi-tui): описания пунктов списков (в т.ч. описания
 *    скиллов из расширений в автодополнении /) переводятся ДО усечения шириной.
 * 3b. Патчит `WelcomeComponent/WelcomeHeader.render` (pi-powerline-footer):
 *     переводит строки welcome-бокса и выравнивает их ширину к верхней
 *     рамке (ANSI-aware). Без этого перевод на уровне stdout оставлял
 *     «призрачные» хвосты правее рамки: ТUI-диф сравнивает строки до
 *     stdout-патча, и старые широкие хвосты не перезаписывались.
 * 3. Патчит `pi.registerTool`: описания инструментов и аргументов для TUI.
 * 4. Патчит `pi.registerCommand`: описания slash-команд (автодополнение).
 * 4b. Патчит `pi.registerShortcut`: описания хоткеев расширений (секция «Расширения» в /hotkeys).
 * 5. Патчит `KeybindingsManager.prototype.create`: описания хоткеев.
 * 6. Патчит `process.stdout.write`: финальная страховка — переводит строки,
 *    которые не прошли через тему (hint-строки редактора, статусы, welcome-бокс).
 *    Мультисстроковые чанки обрабатываются ПОСТРОЧНО (иначе точные ключи
 *    словаря не срабатывают на строках внутри чанка).
 * 7. adjustLineWidth сохраняет ширину ТОЛЬКО для строк боксов (с рамкой │ ╯ …):
 *    обычные строки (статусы, подсказки) переводятся «как есть», без паддинга.
 *
 * Словари RUS / RUS_PARTIAL ниже — и есть «файл русификации». Правь в ОДНОМ
 * месте — в источнике пакета:
 *
 *   A:\PROJECTS\pi-homepc\extensions\pi-i18n-ru.ts   <- ИСТИННЫЙ ИСТОЧНИК
 *   A:\PROJECTS\pi-dev\pi-homepc\extensions\pi-i18n-ru.ts  (git-копия)
 *   C:\Users\HOME-PC\.pi\agent\extensions\pi-i18n-ru.ts    (активная копия)
 *
 * После `pi update` / обновления пакетов:
 *   - прогони A:\PROJECTS\pi-homepc\scripts\i18n-scan.cjs (находит новые
 *     description-строки в dist, не покрытые словарём);
 *   - переведи новые строки и описания SKILL.md новых/обновлённых скиллов;
 *   - скопируй файл в C:\Users\HOME-PC\.pi\agent\extensions\.
 *   Ключи — английские строки ядра/пакетов, они стабильны между версиями.
 *
 * Индикатор: строка `[RU] i18n-ru активен` в статус-баре (setStatus на session_start).
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// ---------------------------------------------------------------------------
// СЛОВАРЬ: английская строка -> русская (точное совпадение)
// ---------------------------------------------------------------------------
const RUS: Record<string, string> = {
	// === Заголовки и диалоги ===
	"What's New": "Что нового",
	"Extension Updates": "Обновления расширений",
	"Package Updates Available": "Доступны обновления пакетов",
	"Update Available": "Доступно обновление",
	"Session Info": "Информация о сессии",
	"Rename Session": "Переименовать сессию",
	"Resume Session (All)": "Возобновить сессию (все)",
	"Resume Session (Current Folder)": "Возобновить сессию (текущая папка)",
	"Fork from Message": "Ветвление от сообщения",
	"Import session": "Импорт сессии",
	"Import Session": "Импорт сессии",
	"Keyboard Shortcuts": "Горячие клавиши",
	"Select authentication method:": "Выберите способ авторизации:",
	"Select provider to configure:": "Выберите провайдера для настройки:",
	"Select provider to logout:": "Выберите провайдера для выхода:",
	"Sign in with an API key": "Вход по API-ключу",
	"Sign in with an account": "Вход по аккаунту",
	"Sign in with Radius": "Вход через Radius",
	"Log in to a provider or configure an API key first": "Сначала войдите в провайдера или укажите API-ключ",
	"Authentication": "Авторизация",
	"Model Configuration": "Настройка модели",
	"Thinking Level": "Уровень мышления",
	"Project trust": "Доверие к проекту",
	"Project settings": "Настройки проекта",
	"User settings": "Пользовательские настройки",
	"Global Resources": "Глобальные ресурсы",
	"Project Local Resources": "Локальные ресурсы проекта",
	"Built-in": "Встроенные",
	"Built-in (project override)": "Встроенные (переопределение проекта)",
	"Current folder": "Текущая папка",
	"◉ Current Folder": "◉ Текущая папка",
	"○ Current Folder | ": "○ Текущая папка | ",
	"◉ All": "◉ Все",
	"Session deleted": "Сессия удалена",
	"Session moved to trash": "Сессия перемещена в корзину",
	"Cannot delete the currently active session": "Нельзя удалить активную сессию",
	"Pick a theme.": "Выберите тему.",
	"Automatic Theme": "Автоматическая тема",
	"System (matches your terminal colors)": "Системная (цвета вашего терминала)",
	"Dark theme": "Тёмная тема",
	"Light theme": "Светлая тема",
	"Dark": "Тёмная",
	"Light": "Светлая",
	"Theme created from your terminal's colors": "Тема, созданная из цветов вашего терминала",
	"Choose themes for terminal light and dark appearance.": "Выберите темы для светлого и тёмного оформления терминала.",
	"Light/dark detection requires terminal support.": "Определение светлого/тёмного требует поддержки терминала.",
	"Select a theme, or choose automatic to follow terminal appearance.": "Выберите тему или «автоматически» для следования оформлению терминала.",
	"Select the theme to use for dark terminal appearance": "Тема для тёмного оформления терминала",
	"Select the theme to use for light terminal appearance": "Тема для светлого оформления терминала",
	"Save and go back": "Сохранить и вернуться",
	"Switch to one theme for light and dark": "Одна тема для светлого и тёмного",
	"Use separate themes for light and dark terminal appearance": "Раздельные темы для светлого и тёмного терминала",
	"Theme to use in automatic mode when the terminal is dark": "Тема в авто-режиме для тёмного терминала",
	"Theme to use in automatic mode when the terminal is light": "Тема в авто-режиме для светлого терминала",
	"Color theme for the interface": "Цветовая тема интерфейса",
	"Select a model to configure": "Выберите модель для настройки",
	"Select default thinking level for this model": "Модель мышления по умолчанию для этой модели",
	"No models available": "Нет доступных моделей",
	"No providers available": "Нет доступных провайдеров",
	"No matching providers": "Нет подходящих провайдеров",
	"No API key providers available.": "Нет провайдеров с API-ключом.",
	"No account providers available.": "Нет провайдеров с аккаунтом.",
	"No login methods available.": "Нет способов входа.",
	"No login providers available.": "Нет провайдеров для входа.",
	"Model catalogs refreshed.": "Каталоги моделей обновлены.",
	"Model refresh timed out; showing cached models.": "Тайм-аут обновления моделей; показаны кэшированные модели.",
	"Model refresh timed out; searching cached models.": "Тайм-аут обновления моделей; поиск по кэшированным.",
	"Only showing models from configured providers. Use /login to add providers.": "Показаны только модели настроенных провайдеров. /login — добавить провайдера.",
	"Model selection saved to settings": "Выбор модели сохранён в настройках",
	"Model unavailable": "Модель недоступна",
	"Only one model available": "Доступна только одна модель",
	"Only one model in scope": "В скоупе только одна модель",
	"Current model does not support thinking": "Текущая модель не поддерживает мышление",
	"Waiting for authentication...": "Ожидание авторизации...",
	"Login cancelled": "Вход отменён",
	"Import cancelled": "Импорт отменён",
	"Resume cancelled": "Возобновление отменено",
	"Navigation cancelled": "Навигация отменена",
	"Compaction cancelled": "Сжатие отменено",
	"Auto-compaction cancelled": "Авто-сжатие отменено",
	"Auto-compacting... (escape to cancel)": "Авто-сжатие... (Esc — отмена)",
	"Compacting context... (escape to cancel)": "Сжатие контекста... (Esc — отмена)",
	"Summarizing branch... (escape to cancel)": "Суммаризация ветки... (Esc — отмена)",
	"Compacting...": "Сжатие...",
	"Branch summarization cancelled": "Суммаризация ветки отменена",
	"Retry cancelled": "Повтор отменён",
	"Nothing to clone yet": "Пока нечего клонировать",
	"Cloned to new session": "Склонировано в новую сессию",
	"Forked to new session": "Ветвление в новую сессию",
	"Resumed session": "Сессия восстановлена",
	"Navigated to selected point": "Переход к выбранной точке",
	"Already at this point": "Уже в этой точке",
	"No entries in session": "Нет записей в сессии",
	"No messages to fork from": "Нет сообщений для ветвления",
	"No queued messages to restore": "Нет ожидающих сообщений",
	"No summary": "Нет саммари",
	"No content to summarize": "Нет контента для саммари",
	"No summary generated": "Саммари не сгенерировано",
	"No changelog entries found.": "Записи changelog не найдены.",
	"No agent messages to copy yet.": "Сообщений агента пока нет.",
	"Selected entry has no text to copy": "В выбранной записи нет текста для копирования",
	"Copied last agent message to clipboard": "Последнее сообщение агента скопировано",
	"Copied selected message to clipboard": "Выбранное сообщение скопировано",
	"Code copied to clipboard": "Код скопирован в буфер",
	"Copied URL to clipboard": "URL скопирован в буфер",
	"Copy code manually": "Скопируйте код вручную",
	"Copying code...": "Копирование кода...",
	"Browser open requested": "Запрос открытия браузера",
	"Queued message for after compaction": "Сообщение поставлено в очередь после сжатия",
	"Context overflow detected, ": "Обнаружен переполнение контекста, ",
	"Completed compaction is missing from the session context": "Завершённое сжатие отсутствует в контексте сессии",
	"Startup is still in progress": "Запуск ещё идёт",
	"Close active overlays before changing TUI mode": "Закройте активные оверлеи перед сменой режима TUI",
	"Fullscreen layout is not initialized": "Полноэкранный режим не инициализирован",
	"Suspend to background is not supported on Windows": "Приостановка в фон не поддерживается на Windows",
	"Clipboard file path contains control characters": "Путь к файлу в буфере содержит управляющие символы",
	"A bash command is already running. Press Esc to cancel it first.": "Bash-команда уже выполняется. Сначала отмените её (Esc).",
	"Operation aborted": "Операция прервана",
	"Request was aborted": "Запрос прерван",
	"Response was truncated before completion.": "Ответ был усечён до завершения.",
	"Unknown error": "Неизвестная ошибка",
	"Unknown error occurred": "Произошла неизвестная ошибка",
	"Empty regex": "Пустой regex",
	"Failed to create session": "Не удалось создать сессию",
	"Failed to fork session": "Не удалось выполнить ветвление",
	"Failed to import session": "Не удалось импортировать сессию",
	"Failed to resume session": "Не удалось возобновить сессию",
	"Custom summarization instructions": "Пользовательские инструкции саммари",
	"Summarize (cmd)": "Саммари",
	"Summarize branch?": "Суммаризировать ветку?",
	"Summarize with custom prompt": "Саммари с пользовательским промптом",
	"Branch summary": "Саммари ветки",
	"To resume this session:": "Для возобновления этой сессии:",
	"Read the blog post:": "Прочитать блог-пост:",
	"Opt-in to anonymous usage data sharing?": "Отправить анонимные данные о использовании?",
	"Share anonymous usage data": "Анонимные данные о использовании",
	"Install telemetry": "Установить телеметрию",
	"Reloaded keybindings, extensions, skills, prompts, themes, and context files": "Перезагружены: клавиши, расширения, скиллы, промты, темы, контекстные файлы",
	"Reloaded keybindings, extensions, skills, prompts, themes, and context files; saved project trust": "Перезагружены: клавиши, расширения, скиллы, промты, темы, контекстные файлы; доверие проекта сохранено",
	"Reloading keybindings, extensions, skills, prompts, themes, and context files...": "Перезагрузка: клавиши, расширения, скиллы, промты, темы, контекстные файлы...",
	"Cache miss": "Пропуск кэша",
	"Cache miss after model switch": "Пропуск кэша после смены модели",
	"Package updates are available. Run ": "Доступны обновления пакетов. Выполните ",
	"Radius is a service crafted for Pi by the builders of Pi, Earendil Works": "Radius — сервис для Pi от создателей Pi, Earendil Works",

	// === Статусы ===
	"Thinking...": "Думаю...",
	"Working": "Работаю",
	"Idle": "Ожидание",
	"Compaction": "Сжатие",
	"Error": "Ошибка",
	"Warning": "Предупреждение",
	"aborted": "прервано",
	"cancelled": "отменено",
	"complete": "завершено",
	"running": "выполняется",
	"updated": "обновлено",
	"no results": "ничего не найдено",

	// === Подписи-один-слово (селекторы, футер) ===
	"All": "Все",
	"Named": "Именованные",
	"Recent": "Недавние",
	"Threaded": "По веткам",
	"Fuzzy": "Размытый",
	"Apply": "Применить",
	"Ask": "Спросить",
	"Always trust": "Всегда доверять",
	"Never trust": "Никогда не доверять",
	"Do not trust": "Не доверять",
	"Summarize": "Саммари",
	"Messages": "Сообщения",
	"Context": "Контекст",
	"Cost": "Стоимость",
	"Tokens": "Токены",
	"Input": "Ввод",
	"Output": "Выход",
	"Theme": "Тема",
	"Themes": "Темы",
	"Prompts": "Промты",
	"Skills": "Скиллы",
	"Extensions": "Расширения",
	"Transport": "Транспорт",
	"Total:": "Итого:",
	"Status:": "Статус:",
	"Mode:": "Режим:",
	"Scope: ": "Скоуп: ",
	"Sort: ": "Сортировка: ",
	"Name: ": "Имя: ",
	"ID:": "ID:",
	"File:": "Файл:",
	"User:": "Пользователь:",
	"Assistant:": "Ассистент:",
	"Tools:": "Инструменты:",
	"See:": "См.:",
	"Changelog: ": "Changelog: ",
	"Packages:": "Пакеты:",
	"Type to search:": "Введите для поиска:",
	"Label (empty to remove):": "Метка (пусто — удалить):",
	"Yes": "Да",
	"No": "Нет",
	"OK": "ОК",
	"Cancel": "Отмена",

	// === Настройки (/settings): названия ===
	"Action when pressing Escape twice with empty editor": "Действие при двойном Esc с пустым редактором",
	"Double-escape action": "Действие двойного Esc",
	"Default project trust": "Доверие к проекту по умолчанию",
	"Default thinking level per model": "Мышление по умолчанию для моделей",
	"Per-Model Thinking Level": "Уровень мышления по моделям",
	"Editor padding": "Отступ редактора",
	"Horizontal padding for input editor (0-3)": "Горизонтальный отступ редактора (0-3)",
	"Output padding": "Отступ вывода",
	"Horizontal padding for messages, tool output, and command output": "Горизонтальный отступ сообщений и вывода инструментов",
	"Image width": "Ширина изображений",
	"Preferred inline image width in terminal cells": "Ширина inline-изображений в ячейках терминала",
	"Auto-resize images": "Авто-ресайз изображений",
	"Resize large images to 2000x2000 max for better model compatibility": "Ресайз больших изображений до 2000x2000 для совместимости",
	"Show images": "Показывать изображения",
	"Render images inline in terminal": "Рендер изображений inline в терминале",
	"Show images inline in terminal": "Показывать изображения inline в терминале",
	"Block images": "Блокировать изображения",
	"Prevent images from being sent to LLM providers": "Не отправлять изображения в LLM-провайдеры",
	"Show text placeholder instead": "Показывать текстовый плейсхолдер",
	"Autocomplete max items": "Максимум элементов автодополнения",
	"Max visible items in autocomplete dropdown (3-20)": "Максимум видимых элементов автодополнения (3-20)",
	"Auto-compact": "Авто-сжатие",
	"Automatically compact context when it gets too large": "Автоматически сжимать контекст при переполнении",
	"Hide thinking": "Скрывать мышление",
	"Hide thinking blocks in assistant responses": "Скрывать блоки мышления в ответах ассистента",
	"Terminal progress": "Прогресс в терминале",
	"Show OSC 9;4 progress indicators in the terminal tab bar": "Индикаторы прогресса OSC 9;4 в вкладке терминала",
	"Clear on shrink": "Очистка при сжатии",
	"Clear empty rows when content shrinks (may cause flicker)": "Очистка пустых строк при уменьшении контента (может мигать)",
	"Show hardware cursor": "Аппаратный курсор",
	"Use the terminal cursor instead of Pi's drawn cursor": "Курсор терминала вместо нарисованного",
	"Show condensed changelog after updates": "Сокращённый changelog после обновлений",
	"Collapse changelog": "Сворачивать changelog",
	"Quiet startup": "Тихий запуск",
	"Disable verbose printing at startup (header: keep only the startup header)": "Без подробного вывода при старте (только заголовок)",
	"Mermaid diagrams": "Диаграммы Mermaid",
	"Render Mermaid code blocks as Unicode diagrams": "Рендер Mermaid-блоков как Unicode-диаграммы",
	"Skill commands": "Команды скиллов",
	"Register skills as /skill:name commands": "Скиллы как команды /skill:name",
	"TUI mode": "Режим TUI",
	"Interface layout; regular mode uses the terminal's normal scrollback": "Раскладка интерфейса; обычный режим — обычный скроллбэк терминала",
	"Fullscreen scrollbar": "Скроллбар в полноэкранном режиме",
	"Scrollbar behavior in fullscreen mode; has no effect in regular mode": "Скроллбар в полноэкранном режиме; в обычном не действует",
	"Fullscreen wheel scrolling": "Колесо мыши в полноэкранном режиме",
	"Lines per mouse-wheel event in fullscreen mode; 'auto' speeds up fast wheel spins where the terminal does not": "Строк на событие колеса в полноэкранном режиме; 'auto' ускоряет быстрое вращение",
	"Fullscreen copy on select": "Копирование при выделении (полноэкранный)",
	"Automatically copy selected text in fullscreen mode; disable to copy selections with Ctrl+X": "Автокопирование выделенного в полноэкранном режиме; Ctrl+X — вручную",
	"Fullscreen exit output": "Вывод при выходе из полноэкранного",
	"Print the transcript or only a session resume hint when exiting fullscreen mode": "Транскрипт или только подсказка возобновления при выходе",
	"Tree filter mode": "Режим фильтра дерева",
	"Default filter when opening /tree": "Фильтр по умолчанию при открытии /tree",
	"Steering mode": "Режим управления",
	"Enter while streaming queues steering messages. 'one-at-a-time': deliver one, wait for response. 'all': deliver all at once.": "Enter во время стриминга ставит сообщения в очередь. 'one-at-a-time': по одному; 'all': все сразу.",
	"Follow-up mode": "Режим follow-up",
	"Change mode": "Сменить режим",
	"Session share destination": "Адрес шаринга сессий",
	"Where to upload sessions with /share (auto prefers Radius when authenticated, otherwise GitHub Gist)": "Куда /share загружает сессии (auto: Radius при авторизации, иначе GitHub Gist)",
	"Cache warming": "Прогрев кэша",
	"off; streaming while the agent runs; idle also between runs while continuation stays profitable": "off; стриминг во время работы агента; idle — между запусками, пока продолжение остаётся выгодным",
	"(clear override)": "(сбросить override)",
	"  automatic": "  автоматический",
	"Cache miss notices": "Уведомления о пропусках кэша",
	"Show transcript notices for cache costs and provider recovery diagnostics": "Заметки о стоимости кэша и диагностике восстановления",
	"Anthropic extra usage": "Доп. использование Anthropic",
	"Warn when Anthropic subscription auth may use paid extra usage": "Предупреждать о платном доп. использовании Anthropic",
	"Enable or disable individual warnings": "Включать/выключать отдельные предупреждения",
	"Warnings": "Предупреждения",
	"Fallback behavior when no extension or saved trust decision decides project trust": "Поведение, если расширение и сохранённое решение не определяют доверие",
	"HTTP idle timeout": "HTTP idle-тайм-аут",
	"Maximum idle gap while waiting for HTTP headers or body chunks. Disable for local models that pause longer than five minutes.": "Макс. пауза ожидания HTTP-заголовков/чанков. Для локальных моделей, паузящих >5 мин, отключите.",
	"Preferred transport for providers that support multiple transports": "Предпочтительный транспорт для провайдеров с несколькими",
	"Send an anonymous version/update ping after changelog-detected updates": "Анонимный ping о версии/обновлениях после детектированных обновлений",

	// === Настройки (/settings): описания (settings-schema) ===
	"samplingParams per thinking level, merged over samplingParams.": "samplingParams по уровню мышления, накладываются на samplingParams.",
	"Fields merged into every request body. Applies only to OpenAI-compatible APIs.": "Поля, сливаемые в тело каждого запроса. Только для OpenAI-совместимых API.",
	"Request headers. Values resolve like apiKey.": "Заголовки запроса. Значения резолвятся как apiKey.",
	"Model ID sent to the API.": "ID модели, отправляемый в API.",
	"Overrides the provider api.": "Переопределяет api провайдера.",
	"Overrides the provider baseUrl.": "Переопределяет baseUrl провайдера.",
	"Display name.": "Отображаемое имя.",
	"API base URL. Also applies to the provider's built-in models.": "Базовый URL API. Также действует для встроенных моделей провайдера.",
	"OAuth login flow. Requires baseUrl.": "OAuth-поток входа. Требует baseUrl.",
	"Whether to send the resolved API key as Authorization: Bearer.": "Отправлять ли решённый API-ключ как Authorization: Bearer.",
	"Tokens reserved for the prompt and LLM response.": "Токены, зарезервированные под промт и ответ LLM.",
	"SDK or provider request timeout in milliseconds.": "Тайм-аут запроса SDK/провайдера в миллисекундах.",
	"SDK or provider retry attempts.": "Число повторных попыток SDK/провайдера.",
	"Maximum server-requested delay before failing.": "Макс. задержка, запрошенная сервером, до сбоя.",
	"Exponential backoff base delay in milliseconds: 2s, 4s, 8s.": "Базовая задержка экспоненциального backoff в мс: 2с, 4с, 8с.",
	"Legacy retry delay setting. Use provider.maxRetryDelayMs instead.": "Устаревшая настройка retry-задержки. Используйте provider.maxRetryDelayMs.",
	"Preferred inline image width in terminal cells.": "Предпочтительная ширина inline-изображения в ячейках терминала.",
	"Clear empty rows when content shrinks.": "Очищать пустые строки при уменьшении контента.",
	"Show OSC 9;4 terminal progress indicators.": "Показывать индикаторы прогресса OSC 9;4 в терминале.",
	"Resize images to 2000x2000 maximum for better model compatibility.": "Ресайзить изображения до 2000x2000 для совместимости с моделями.",
	"When true, prevents all images from being sent to LLM providers.": "Если true, блокирует отправку всех изображений в LLM-провайдеры.",
	"Estimated tokens available for inline codemode tool declarations.": "Оценка токенов, доступных для inline-объявлений инструментов codemode.",
	"Load all resources from the package.": "Загружать все ресурсы из пакета.",
	"When false, start empty and only apply explicit resource patterns.": "Если false, старт пустой, применяются только явные паттерны ресурсов.",
	"Package source for npm or git packages. Use the string form to load all resources or the object form to filter resources.": "Источник пакета npm или git. Строковая форма — все ресурсы, объектная — с фильтром.",
	"JSON Schema reference.": "Ссылка JSON Schema.",
	"Last seen changelog version per extension package.": "Последняя увиденная версия changelog по пакету расширений.",
	"Show cache cost and provider recovery notices.": "Показывать заметки о стоимости кэша и восстановлении провайдера.",
	"Command for Ctrl+G external editor; takes precedence over VISUAL and EDITOR.": "Команда внешнего редактора для Ctrl+G; приоритетнее VISUAL и EDITOR.",
	"Custom shell path, for example for Cygwin on Windows, with support for leading ~ expansion.": "Путь к кастомному shell, напр. Cygwin на Windows; поддерживается ~ в начале.",
	"Global setting only.": "Только глобальная настройка.",
	"Prefix prepended to every bash command, for example to enable shell aliases.": "Префикс, добавляемый к каждой bash-команде, напр. для алиасов shell.",
	"Show the condensed changelog after update; use /changelog for the full changelog.": "Сокращённый changelog после обновления; полный — /changelog.",
	"Send an anonymous version and update ping after changelog-detected updates.": "Анонимный ping о версии и обновлениях после детектированных обновлений.",
	"Opt in to analytics data sharing.": "Согласие на передачу данных аналитики.",
	"Analytics tracking identifier, generated when analytics is enabled.": "Идентификатор аналитики, генерируется при включении.",
	"npm or git package sources, as strings or objects with resource filtering.": "Источники пакетов npm/git: строки или объекты с фильтром ресурсов.",
	"Local extension file paths or directories.": "Пути к локальным файлам/каталогам расширений.",
	"Stable installation UUID, generated when authentication first needs it. Global only.": "Стабильный UUID установки, генерируется при первой нужде авторизации. Только глобально.",
	"Local theme file paths or directories.": "Пути к локальным файлам/каталогам тем.",
	"Model patterns for cycling, in the same format as the --models CLI flag.": "Паттерны моделей для цикла; формат как у CLI-флага --models.",
	"Initial tool selection. Plain names replace the inherited selection; +name and -name entries add or remove tools.": "Начальный выбор инструментов. Простые имена заменяют унаследованный выбор; +name и -name добавляют/удаляют.",
	"Action for double-escape with an empty editor.": "Действие при двойном Esc с пустым редактором.",
	"Custom token budgets for thinking levels.": "Кастомные токен-бюджеты уровней мышления.",
	"Horizontal padding for the input editor.": "Горизонтальный отступ редактора ввода.",
	"Horizontal padding for transcript content.": "Горизонтальный отступ контента транскрипта.",
	"Maximum visible items in the autocomplete dropdown.": "Максимум видимых элементов автодополнения.",
	"Show the terminal cursor while still positioning it for IME.": "Показывать курсор терминала, позиционируя его для IME.",
	"Custom session storage directory, in the same format as the --session-dir CLI flag.": "Кастомная папка хранения сессий; формат как у CLI-флага --session-dir.",
	"Proxy URL applied as HTTP_PROXY and HTTPS_PROXY for Pi-managed HTTP clients.": "URL прокси как HTTP_PROXY/HTTPS_PROXY для HTTP-клиентов под управлением Pi.",
	"Lines scrolled per wheel event in fullscreen mode; numeric values are clamped from 1 to 100.": "Строк прокрутки на событие колеса в полноэкранном режиме; числовые значения в пределах 1-100.",
	"Legacy setting migrated to steeringMode.": "Устаревшая настройка, мигрирована в steeringMode.",
	"Legacy setting migrated to transport.": "Устаревшая настройка, мигрирована в transport.",

	// === Токены темы (редактор темы) ===
	"Primary accent color (logo, selected items, cursor)": "Основной акцентный цвет (логотип, выбранные элементы, курсор)",
	"Normal borders": "Обычные рамки",
	"Highlighted borders": "Выделенные рамки",
	"Subtle borders": "Сдержанные рамки",
	"Success states": "Состояния успеха",
	"Error states": "Состояния ошибок",
	"Warning states": "Состояния предупреждений",
	"Secondary/dimmed text": "Вторичный/затемнённый текст",
	"Very dimmed text (more subtle than muted)": "Сильно затемнённый текст (сдержаннее muted)",
	"Default text color (usually empty string)": "Цвет текста по умолчанию (обычно пустая строка)",
	"Thinking block text color": "Цвет текста блока мышления",
	"Selected item background": "Фон выбранного элемента",
	"Transcript search match text and current-match background (falls back to text when omitted)": "Текст совпадений поиска в транскрипте и фон текущего совпадения (без него — текст)",
	"User message background": "Фон сообщения пользователя",
	"User message text color": "Цвет текста сообщения пользователя",
	"Custom message background (hook-injected messages)": "Фон кастомных сообщений (вставленных хуками)",
	"Custom message text color": "Цвет текста кастомных сообщений",
	"Custom message type label color": "Цвет лейбла типа кастомного сообщения",
	"Tool execution box (pending state)": "Бокс выполнения инструмента (ожидание)",
	"Tool execution box (success state)": "Бокс выполнения инструмента (успех)",
	"Tool execution box (error state)": "Бокс выполнения инструмента (ошибка)",
	"Tool execution box title color": "Цвет заголовка бокса инструмента",
	"Tool execution box output text color": "Цвет текста вывода бокса инструмента",
	"Markdown heading text": "Текст заголовков Markdown",
	"Markdown link text": "Текст ссылок Markdown",
	"Markdown link URL": "URL ссылок Markdown",
	"Markdown inline code": "Inline-код Markdown",
	"Markdown code block content": "Содержимое блоков кода Markdown",
	"Markdown code block fences": "Ограждения блоков кода Markdown",
	"Markdown blockquote text": "Текст цитат Markdown",
	"Markdown blockquote border": "Рамка цитат Markdown",
	"Markdown horizontal rule": "Горизонтальная линия Markdown",
	"Markdown list bullets/numbers": "Маркеры/номера списков Markdown",
	"Added lines in tool diffs": "Добавленные строки в дифах инструментов",
	"Removed lines in tool diffs": "Удалённые строки в дифах инструментов",
	"Context lines in tool diffs": "Контекстные строки в дифах инструментов",
	"Syntax highlighting: comments": "Подсветка синтаксиса: комментарии",
	"Syntax highlighting: keywords": "Подсветка синтаксиса: ключевые слова",
	"Syntax highlighting: function names": "Подсветка синтаксиса: имена функций",
	"Syntax highlighting: variable names": "Подсветка синтаксиса: имена переменных",
	"Syntax highlighting: string literals": "Подсветка синтаксиса: строковые литералы",
	"Syntax highlighting: number literals": "Подсветка синтаксиса: числовые литералы",
	"Syntax highlighting: type names": "Подсветка синтаксиса: имена типов",
	"Syntax highlighting: operators": "Подсветка синтаксиса: операторы",
	"Syntax highlighting: punctuation": "Подсветка синтаксиса: пунктуация",
	"Thinking level border: off": "Рамка уровня мышления: off",
	"Thinking level border: minimal": "Рамка уровня мышления: minimal",
	"Thinking level border: low": "Рамка уровня мышления: low",
	"Thinking level border: medium": "Рамка уровня мышления: medium",
	"Thinking level border: high": "Рамка уровня мышления: high",
	"Thinking level border: xhigh": "Рамка уровня мышления: xhigh",
	"Thinking level border: max (falls back to thinkingXhigh when omitted)": "Рамка уровня мышления: max (без него — thinkingXhigh)",
	"Editor border color in bash mode": "Цвет рамки редактора в bash-режиме",

	// === Хоткеи (pi-tui keybindings) ===
	"Move cursor up": "Курсор вверх",
	"Move cursor down": "Курсор вниз",
	"Select previous prompt history entry": "Предыдущая запись истории промтов",
	"Select next prompt history entry": "Следующая запись истории промтов",
	"Move cursor left": "Курсор влево",
	"Move cursor right": "Курсор вправо",
	"Move cursor word left": "Курсор на слово влево",
	"Move cursor word right": "Курсор на слово вправо",
	"Move to line start": "В начало строки",
	"Move to line end": "В конец строки",
	"Jump forward to character": "Прыжок вперёд к символу",
	"Jump backward to character": "Прыжок назад к символу",
	"Page up": "Страница вверх",
	"Page down": "Страница вниз",
	"Delete character backward": "Удалить символ назад",
	"Delete character forward": "Удалить символ вперёд",
	"Delete word backward": "Удалить слово назад",
	"Delete word forward": "Удалить слово вперёд",
	"Delete to line start": "Удалить до начала строки",
	"Delete to line end": "Удалить до конца строки",
	"Yank": "Вставить (yank)",
	"Yank pop": "Yank pop (повтор вставки)",
	"Undo": "Отменить",
	"Insert newline": "Вставить перевод строки",
	"Submit input": "Отправить ввод",
	"Tab / autocomplete": "Tab / автодополнение",
	"Copy selection": "Копировать выделение",
	"Move selection up": "Выделение вверх",
	"Move selection down": "Выделение вниз",
	"Selection page up": "Выделение: страница вверх",
	"Selection page down": "Выделение: страница вниз",
	"Confirm selection": "Подтвердить выбор",
	"Cancel selection": "Отменить выбор",
	"Scroll viewport up one page": "Прокрутка на страницу вверх",
	"Scroll viewport down one page": "Прокрутка на страницу вниз",
	"Scroll viewport up half a page": "Прокрутка на полстраницы вверх",
	"Scroll viewport down half a page": "Прокрутка на полстраницы вниз",
	"Scroll viewport up one line": "Прокрутка на строку вверх",
	"Scroll viewport down one line": "Прокрутка на строку вниз",
	"Jump to previous semantic prompt": "К предыдущему семантическому промту",
	"Jump to next semantic prompt": "К следующему семантическому промту",
	"Search the primary scroll view": "Поиск в основной области прокрутки",
	"Select the next search match": "Следующее совпадение поиска",
	"Select the previous search match": "Предыдущее совпадение поиска",
	"Close transcript search": "Закрыть поиск по транскрипту",
	"Scroll viewport to top": "Прокрутка в начало",
	"Scroll viewport to bottom": "Прокрутка в конец",

	// === Уровни мышления ===
	"No reasoning": "Без мышления",
	"Very brief reasoning (~1k tokens)": "Очень короткое мышление (~1k токенов)",
	"Light reasoning (~2k tokens)": "Лёгкое мышление (~2k токенов)",
	"Moderate reasoning (~8k tokens)": "Среднее мышление (~8k токенов)",
	"Deep reasoning (~16k tokens)": "Глубокое мышление (~16k токенов)",
	"Extra-high reasoning (~32k tokens)": "Очень высокое мышление (~32k токенов)",
	"Maximum reasoning": "Максимальное мышление",

	// === Инструменты (описания и аргументы) ===
	"Read file contents": "Чтение содержимого файла",
	"Path to the file to read (relative or absolute)": "Путь к файлу (относительный или абсолютный)",
	"Line number to start reading from (1-indexed)": "Номер строки для начала чтения (с 1)",
	"Maximum number of lines to read": "Максимум строк для чтения",
	"Use read to examine files instead of cat or sed.": "Используйте read для просмотра файлов, а не cat или sed.",
	"Execute bash commands (ls, grep, find, etc.)": "Выполнение bash-команд (ls, grep, find и т.д.)",
	"Shell command to execute": "Shell-команда для выполнения",
	"Combined stdout and stderr, possibly truncated": "Совмещённый stdout и stderr, возможно усечён",
	"Full output, when truncated": "Полный вывод (при усечении)",
	"Timeout in seconds (optional, no default timeout)": "Тайм-аут в секундах (опционально)",
	"Invalid timeout: must be a finite number of seconds": "Неверный тайм-аут: нужно конечное число секунд",
	"Command aborted": "Команда прервана",
	"Command terminated without an exit code": "Команда завершилась без кода выхода",
	"You can inspect PI_* environment variables for current model and session details.": "Доступны переменные окружения PI_* с деталями текущей модели и сессии.",
	"Execute PowerShell commands": "Выполнение PowerShell-команд",
	"Create or overwrite files": "Создание или перезапись файлов",
	"Content to write to the file": "Содержимое для записи в файл",
	"Path to the file to write (relative or absolute)": "Путь к файлу для записи",
	"Use write only for new files or complete rewrites.": "write — только для новых файлов или полной перезаписи.",
	"Make precise file edits with exact text replacement, including multiple disjoint edits in one call": "Точные правки файла с заменой текста, включая несколько непересекающихся правок за один вызов",
	"Path to the file to edit (relative or absolute)": "Путь к файлу для правки",
	"Replacement text for this targeted edit.": "Текст замены для этой правки.",
	"Use edit for targeted changes. Batch changes to one file in a single call.": "edit — точечные правки. Несколько правок одного файла — за один вызов.",
	"Find files by glob pattern (respects .gitignore)": "Поиск файлов по glob-шаблону (учитывает .gitignore)",
	"Glob pattern to match files, e.g. '*.ts', '**/*.json', or 'src/**/*.spec.ts'": "Glob-шаблон, напр. '*.ts', '**/*.json', 'src/**/*.spec.ts'",
	"Search file contents for patterns (respects .gitignore)": "Поиск содержимого файлов по шаблону (учитывает .gitignore)",
	"Search pattern (regex or literal string)": "Шаблон поиска (regex или литерал)",
	"List directory contents": "Список содержимого каталога",
	"Operation aborted (tool)": "Операция прервана (инструмент)",
	"No files found matching pattern": "Файлы по шаблону не найдены",
	"No matches found": "Совпадений не найдено",
	"Elapsed": "Затрачено",
	"Took": "Заняло",
	"some lines truncated": "часть строк усечена",
	"to expand": "развернуть",
	"to collapse": "свернуть",

	// === Slash-команды (BUILTIN_SLASH_COMMANDS) ===
	"Open settings menu": "Открыть меню настроек",
	"Select model (opens selector UI)": "Выбрать модель (открывает селектор)",
	"Navigate session tree (switch branches)": "Дерево сессии (переключение веток)",
	"Set thinking level": "Задать уровень мышления",
	"Enable/disable models for Ctrl+P cycling": "Вкл/выкл модели для цикла Ctrl+P",
	"Export session (HTML default, or specify path: .html/.jsonl)": "Экспорт сессии (по умолчанию HTML, или путь: .html/.jsonl)",
	"Import a JSONL session, preserving its ID and working directory": "Импорт JSONL-сессии с сохранением ID и рабочей папки",
	"Share session via a Radius artifact or a GitHub gist": "Шаринг сессии через Radius или GitHub gist",
	"Report a bug to the Pi developers": "Сообщить об ошибке разработчикам Pi",
	"Copy last agent message to clipboard": "Копировать последнее сообщение агента",
	"Set session display name": "Задать имя сессии",
	"Show session info and stats": "Информация и статистика сессии",
	"Show changelog entries": "Показать записи changelog",
	"Show all keyboard shortcuts": "Показать все горячие клавиши",
	"Create a new fork from a previous user message": "Новое ветвление от предыдущего сообщения",
	"Duplicate the current session at the current position": "Дублировать сессию в текущей позиции",
	"Save project trust decision for future sessions": "Сохранить решение о доверии проекта",
	"Configure provider authentication": "Настроить авторизацию провайдера",
	"Remove provider authentication": "Убрать авторизацию провайдера",
	"Start a new session (cmd)": "Новая сессия",
	"Manually compact the session context": "Ручное сжатие контекста сессии",
	"Resume another session": "Возобновить другую сессию",
	"Reload keybindings, extensions, skills, prompts, themes, and context files": "Перезагрузка клавиш, расширений, скиллов, промтов, тем, контекстных файлов",

	// === Хоткеи (keybindings, ядро) ===
	"Cancel or abort": "Отмена / прерывание",
	"Clear editor": "Очистить редактор",
	"Exit when editor is empty": "Выход при пустом редакторе",
	"Suspend to background": "Приостановить в фон",
	"Cycle thinking level": "Цикл уровня мышления",
	"Cycle to next model": "Следующая модель",
	"Cycle to previous model": "Предыдущая модель",
	"Select model": "Выбрать модель",
	"Open model selector": "Открыть селектор моделей",
	"Toggle thinking blocks": "Показать/скрыть блоки мышления",
	"Toggle tool output (cmd)": "Показать/скрыть вывод инструментов",
	"Open external editor": "Открыть внешний редактор",
	"Copy selection or last assistant message": "Копировать выделение или последнее сообщение",
	"Queue follow-up message": "Поставить follow-up в очередь",
	"Restore queued messages": "Восстановить ожидающие сообщения",
	"Fork current session": "Ветвление текущей сессии",
	"Start a new session": "Новая сессия",
	"Resume a session": "Возобновить сессию",
	"Open session tree": "Открыть дерево сессии",
	"Delete session": "Удалить сессию",
	"Delete session when query is empty": "Удалить сессию (пустой запрос)",
	"Rename session": "Переименовать сессию",
	"Toggle named session filter": "Фильтр именованных сессий",
	"Toggle session path display": "Показывать пути сессий",
	"Toggle session sort mode": "Сменить сортировку сессий",
	"Save model selection": "Сохранить выбор модели",
	"Save thinking level": "Сохранить уровень мышления",
	"Clear all models": "Очистить все модели",
	"Enable all models": "Включить все модели",
	"Toggle all models for provider": "Все модели провайдера",
	"Move model down in order": "Модель ниже",
	"Move model up in order": "Модель выше",
	"Edit tree label": "Править метку дерева",
	"Fold tree branch or move up": "Свернуть ветку или вверх",
	"Unfold tree branch or move down": "Развернуть ветку или вниз",
	"Toggle tree label timestamps": "Таймстампы меток дерева",
	"Tree filter: cycle backward": "Фильтр дерева: назад",
	"Tree filter: cycle forward": "Фильтр дерева: вперёд",
	"Tree filter: default view": "Фильтр дерева: по умолчанию",
	"Tree filter: hide tool results": "Фильтр дерева: скрыть результаты",
	"Tree filter: labeled entries only": "Фильтр дерева: только с метками",
	"Tree filter: show all entries": "Фильтр дерева: все записи",
	"Tree filter: user messages only": "Фильтр дерева: только сообщения",
	"Paste files on macOS, images, or text from clipboard": "Вставить файлы (macOS), изображения или текст",
	"Toggle tool output": "Показать/скрыть вывод инструментов",

	// === Подсказки редактора (hint-строки) ===
	"for commands": "команды",
	"for external editor": "внешний редактор",
	"to attach": "прикрепить",
	"to clear": "очистить",
	"to cycle models": "цикл моделей",
	"to cycle thinking level": "цикл мышления",
	"to delete to end": "удалить до конца",
	"to edit all queued messages": "править все ожидающие",
	"to exit": "выход",
	"to exit (empty)": "выход (пусто)",
	"to expand thinking": "развернуть мышление",
	"to expand tools": "развернуть инструменты",
	"to interrupt": "прервать",
	"to queue follow-up": "follow-up в очередь",
	"to run bash": "bash",
	"to run bash (no context)": "bash (без контекста)",
	"to select model": "выбрать модель",
	"to suspend": "приостановить",
	"to cancel": "отмена",
	"to cancel,": "отмена,",
	"to close": "закрыть",
	"to copy": "копировать",
	"to copy code": "копировать код",
	"to open browser": "открыть браузер",
	"to open browser and copy code": "браузер + копировать код",
	"to submit": "отправить",
	"more": "ещё",
	"drop files": "бросьте файлы",
	"stored credential": "сохранённое удостоверение",
	"not set": "не задано",

	// === Прочие строки ===
	"all enabled": "все включены",
	"no providers": "нет провайдеров",
	"skip setup": "пропустить настройку",
	"switch mode": "сменить режим",
	"switch to single theme": "одна тема",
	"external editor": "внешний редактор",
	"branch summary": "саммари ветки",
	"context edit": "правка контекста",
	"label time": "время метки",
	"name commands": "именованные команды",
	"Cmd+click to open": "Cmd+клик — открыть",
	"Ctrl+click to open": "Ctrl+клик — открыть",
	"Already compacted": "Уже сжато",
	"Nothing to compact (session too small)": "Нечего сжимать (сессия слишком мала)",
	"No model selected": "Модель не выбрана",
	"No model available for summarization": "Нет модели для саммари",
	"No assistant message issued this call": "Нет сообщения ассистента в этом вызове",
	"Nested tool calls are not available in this context": "Вложенные вызовы инструментов здесь недоступны",
	"UI not available": "UI недоступен",
	"Compaction failed": "Ошибка сжатия",
	"compaction failed": "ошибка сжатия",
	"Can't compact": "Нельзя сжать",
	"Cannot append to a finished output accumulator": "Нельзя добавить в завершённый аккумулятор вывода",
	"Cannot preserve unchanged lines because the base content has a different line count.": "Нельзя сохранить неизменные строки: другое число строк в базе.",
	"Edit tool input is invalid. edits must contain at least one replacement.": "Неверный ввод edit: нужен минимум один replacement.",
	"Replacement range is outside the base content.": "Диапазон замены вне базового содержимого.",
	"Failed to acquire settings lock": "Не удалось получить замок настроек",
	"Failed to acquire trust store lock": "Не удалось получить замок хранилища доверия",
	"Auth storage lock was compromised": "Замок хранилища авторизации скомпрометирован",
	"Session header is missing": "Нет заголовка сессии",
	"Persisted session is missing a session file": "У сохранённой сессии нет файла",
	"Prompt template path does not exist": "Пути к шаблону промта нет",
	"Skill path does not exist": "Пути к скиллу нет",
	"Theme path does not exist": "Пути к теме нет",
	"Provider config is required when registering by name": "При регистрации по имени нужен конфиг провайдера",
	"Missing git install root": "Нет корня установки git",
	"Missing upstream branch name": "Нет имени upstream-ветки",
	"Extension runtime not initialized": "Runtime расширений не инициализирован",
	"Failed to create forked session": "Не удалось создать ветвлённую сессию",
	"Agent is already processing. Specify streamingBehavior ('steer' or 'followUp') to queue the message.": "Агент уже работает. Укажите streamingBehavior ('steer'/'followUp'), чтобы поставить в очередь.",
	"Cannot submit a prompt while compaction is in progress. Wait for compaction to finish and retry.": "Нельзя отправить промт во время сжатия. Дождитесь завершения и повторите.",
	"Truncated response recovery failed after one compact-and-retry attempt.": "Восстановление усечённого ответа не удалось после compact-and-retry.",
	"Wait for compaction to finish before reloading.": "Дождитесь завершения сжатия перед перезагрузкой.",
	"Wait for the current compaction or tree navigation to finish before navigating the session tree.": "Дождитесь завершения сжатия/навигации по дереву.",
	"Wait for the current response to finish before reloading.": "Дождитесь завершения ответа перед перезагрузкой.",
	"Wait for the current response to finish before navigating the session tree.": "Дождитесь завершения ответа перед навигацией по дереву.",
	"fd is not available and could not be downloaded": "fd недоступен и не скачался",
	"Bug report summary": "Саммари баг-репорта",
	"Bug report summary was cancelled": "Саммари баг-репорта отменён",
	"Bug report summary was empty": "Саммари баг-репорта пуст",
	"Turn prefix summarization": "Саммари префикса хода",
	"Copy link to this message": "Скопировать ссылку на сообщение",
	"Paste the authorization code": "Вставьте код авторизации",
	"Virtual model": "Виртуальная модель",
	"Decision now": "Решение сейчас",

	// === Титульная страница (pi-powerline-footer welcome) ===
	"Welcome back!": "С возвращением!",
	"Tips": "Подсказки",
	"Loaded": "Загружено",
	"Recent sessions": "Недавние сессии",
	"No recent sessions": "Нет недавних сессий",
	"No context files, skills, or prompts loaded": "Контекстные файлы, скиллы и промты не загружены",
	" initial prompt tokens": " токенов начального промта",
	"context file": "контекстный файл",
	"context files": "контекстных файла",
	" skill": "скилл",
	" skills": "скиллов",
	" prompt template": "шаблон промта",
	" prompt templates": "шаблонов промта",
	"Press any key to continue": "Нажмите любую клавишу для продолжения",
	"d ago": "дн назад",
	"h ago": "ч назад",
	"m ago": "мин назад",
	"just now": "только что",

	// === Подсказки списков настроек (settings-list) ===
	"Type to search · Enter/Space to change · Esc to cancel": "Введите для поиска · Enter/Пробел — сменить · Esc — отмена",
	"Enter/Space to change · Esc to cancel": "Enter/Пробел — сменить · Esc — отмена",

	// === Скиллы (описания SKILL.md всех установленных пакетов) ===
	// bigpowers
	"Build editorial/magazine/report webpages on a GENUINE Müller-Brockmann modular grid (International Typographic Style) — not a decorative one. Encodes the discipline (columns + modules + baseline, grotesque type, flush-left, restrained black/white/red palette) AND the hard-won front-end engineering to make the grid real, visible, and verified: one CSS-variable source of truth, an interactive grid-toggle overlay that lives in the SAME content box as the content, subgrid \"bands\" so every element snaps to a column line, an 8px baseline lock, and runtime OPTICAL ALIGNMENT that puts display type's ink (not its box) on the line. Ships with a scaffold generator and a Puppeteer verification harness that proves 0px adherence.":
		"Создание редакционных/журнальных/отчётных веб-страниц на ИСТИННОЙ модульной сетке Мюллера-Брокманна (международный типографский стиль) — не декоративной. Задаёт дисциплину (колонки + модули + базлинейн, гротеск, выравнивание по левому краю, сдержанная палитра чёрный/белый/красный) И фронд-енд инженерию, делающую сетку реальной, видимой и проверенной: единый источник истины в CSS-переменных, интерактивный оверлей-переключатель сетки в ТОЙ ЖЕ контент-коробке, subgrid-«полосы» для привязки элементов к колонной линии, 8px базлинейн и ОПТИЧЕСКОЕ ВЫРАВНИВАНИЕ в рантайме. В комплекте генератор каркаса и Puppeteer-проверка с 0px отклонений.",
	"Analyze the blast radius of a proposed change before any code is written. Maps dependents, affected stories, and test coverage. Produces specs/IMPACT_LATEST.md. Use before plan-work on any non-trivial change, when touching a shared module, or when the user asks \"what does this break?\".":
		"Анализ зоны влияния изменения до написания кода. Строит карту зависимостей, затронутых сторис и покрытия тестами. Создаёт specs/IMPACT_LATEST.md. Используй перед plan-work для любого нетривиального изменения, при работе с общим модулем или когда пользователь спрашивает «что это сломает?».",
	"Self-review checklist for the coding agent to run before dispatching a reviewer. Checks CONVENTIONS.md compliance, Boy Scout Rule, test coverage, types, and SOLID. Produces a pass/fail checklist. Use before request-review, before committing, or when user asks for a code quality check.":
		"Чек-лист самопроверки кодинг-агента перед вызовом ревьюера. Проверяет соответствие CONVENTIONS.md, Boy Scout Rule, покрытие тестами, типы и SOLID. Даёт чек-лист pass/fail. Используй перед request-review, перед коммитом или при запросе проверки качества кода.",
	"Evaluate an incoming project plan against bigpowers principles and conventions, surface gaps, and produce a READY/NOT READY verdict before engagement begins. Use when a new project arrives, when adapting a foreign plan, or before running seed-conventions on an unfamiliar codebase.":
		"Оценка входящего плана проекта по принципам и конвенциям bigpowers, выявление пробелов, вердикт READY/NOT READY до начала работы. Используй при поступлении нового проекта, адаптации чужого плана или перед seed-conventions на незнакомой кодовой базе.",
	"Eight-step epic build cycle — reads state.yaml, execution-status.yaml, and one epic capsule; updates status via bp-yaml-set or direct edit. Resume mode runs one step per invocation. Use instead of ad-hoc execute-plan for release work.":
		"Восьмиступенчатый цикл сборки эпика — читает state.yaml, execution-status.yaml и капсулу эпика; обновляет статус через bp-yaml-set или прямое редактирование. Resume-режим выполняет по одному шагу за вызов. Используй вместо ad-hoc execute-plan для release-работы.",
	"Add a new requirement or reorder epics by WSJF against specs/release-plan.yaml and epic capsule directories. Modes Add and Reorder. Use when a new requirement arrives mid-release or the plan needs prioritization.":
		"Добавление нового требования или переупорядочивание эпиков по WSJF против specs/release-plan.yaml и капсул эпиков. Режимы Add и Reorder. Используй при поступлении требования в середине релиза или когда план нужно приоритизировать.",
	"Reviews working-tree changes, then drafts a Conventional Commits title/body and states the semantic-release version bump a single such commit would imply. Also notes which defensive-code categories were touched. Use when the user wants to commit recent work, prepare a Conventional Commits message, or asks for semantic-release / semver-consistent messaging before git commit.":
		"Ревью изменений рабочей области, затем черновик заголовка/тела Conventional Commits и указание повышения версии semantic-release для такого коммита. Отмечает затронутые категории defensive-code. Используй для коммита работы, подготовки сообщения Conventional Commits или semver-сообщения перед git commit.",
	"Chain multiple bigpowers skills into a custom workflow recipe saved in specs/. Use when a project repeats a non-standard skill sequence, or user wants a documented playbook beyond orchestrate-project modes.":
		"Сцепление нескольких скиллов bigpowers в пользовательский рецепт workflow, сохраняемый в specs/. Используй, когда проект повторяет нестандартную последовательность скиллов или нужен задокументированный playbook вне режимов orchestrate-project.",
	"Create new bigpowers skills with proper structure, progressive disclosure, and bundled resources. Use when user wants to create, write, or build a new skill for the bigpowers lifecycle.":
		"Создание новых скиллов bigpowers с правильной структурой, прогрессивным раскрытием и упакованными ресурсами. Используй, когда пользователь хочет создать новый скилл для жизненного цикла bigpowers.",
	"Find deepening opportunities in a codebase, informed by the domain language in specs/tech-architecture/tech-stack.md and the decisions in specs/adr/. Use when the user wants to improve architecture, find refactoring opportunities, consolidate tightly-coupled modules, or make a codebase more testable and AI-navigable.":
		"Поиск возможностей углубления архитектуры, с опорой на доменный язык в specs/tech-architecture/tech-stack.md и решения в specs/adr/. Используй для улучшения архитектуры, поиска рефакторингов, консолидации связанных модулей или повышения тестируемости и навигируемости кодовой базы.",
	"Extract a DDD-style ubiquitous language glossary from the current conversation, flagging ambiguities and proposing canonical terms. Saves to specs/UBIQUITOUS_LANGUAGE_LATEST.md. Use when user wants to define domain terms, build a glossary, harden terminology, create a ubiquitous language, or mentions \"domain model\" or \"DDD\".":
		"Извлечение глоссария DDD-языка (ubiquitous language) из текущего разговора, пометка неоднозначностей и предложение канонических терминов. Сохраняет в specs/UBIQUITOUS_LANGUAGE_LATEST.md. Используй для определения доменных терминов, создания глоссария, упрочнения терминологии или при упоминании «domain model»/«DDD».",
	"TOMBSTONE — renamed/merged to plan-work. This stub resolves for one release then is removed.":
		"TOMBSTONE — переименован/слит в plan-work. Заглушка проживёт один релиз, затем удалится.",
	"Delegate one complex task to a single subagent, review its work in two stages before merging back. Sequential — one agent at a time, with oversight. Use when a task is complex and requires careful review before the result is accepted. Distinct from dispatch-agents (no parallelism here; reviewer sees full diff before proceeding).":
		"Делегирование одной сложной задачи одному субагенту, двухэтапный ревью его работы перед слиянием. Последовательно — по одному агенту, с контролем. Используй, когда задача сложная и требует тщательного ревью. Отличается от dispatch-agents (нет параллелизма; ревьюер видит весь диф).",
	"Build → verify artifact → deploy → wait → smoke deployment pipeline. Platform-agnostic (MCP or CLI), with configurable timeout, retry with exponential backoff, and integrated health-check. The deploy half of CI/CD: run after build to push to production.":
		"Конвейер: сборка → проверка артефакта → деплой → ожидание → smoke-проверка. Независим от платформы (MCP или CLI), с настраиваемым тайм-аутом, повтором с экспоненциальным backoff и health-check. Деплой-половина CI/CD: запускается после build для вывода в прод.",
	"Generate multiple radically different interface designs for a module using parallel sub-agents, then compare trade-offs. Based on \"Design It Twice\" from A Philosophy of Software Design. Use when user wants to design an API, explore interface options, compare module shapes, or mentions \"design it twice\".":
		"Генерация нескольких радикально разных дизайнов интерфейса модуля параллельными субагентами, затем сравнение trade-offs. По мотивам «Design It Twice» из A Philosophy of Software Design. Используй для дизайна API, сравнения вариантов интерфейсов или при упоминании «design it twice».",
	"Test-driven development with red-green-refactor loop using vertical slices. Use for features (epic tasks) or bugs (specs/bugs/BUG-*.md).":
		"Тест-драйвенная разработка с циклом red-green-refactor на вертикальных срезах. Используй для фич (задач эпика) или багов (specs/bugs/BUG-*.md).",
	"Run 4-phase root cause analysis — reproduce, isolate, hypothesize, verify. Use when a bug is confirmed but root cause is unclear, after investigate-bug, or when user mentions root cause analysis.":
		"Четырёхфазный анализ корневой причины: воспроизвести, изолировать, гипотеза, проверка. Используй, когда баг подтверждён, но причина неясна, после investigate-bug или при упоминании root cause analysis.",
	"Diagnose why agent orchestration stopped producing progress — silent stalls in /loop, dispatch-agents, or execute-plan. Use when work appears hung, no output for several minutes, or a subagent never returned.":
		"Диагностика остановки оркестрации агентов — тихие зависания в /loop, dispatch-agents или execute-plan. Используй, когда работа повисла, нет вывода несколько минут или субагент не вернулся.",
	"Dispatch multiple subagents in parallel on independent tasks. No waiting between them — all run concurrently. Use when tasks are truly decoupled and speed matters. Distinct from delegate-task (concurrent here, no inter-task review gate).":
		"Запуск нескольких субагентов параллельно на независимых задачах. Без ожидания — все работают одновременно. Используй, когда задачи действительно развязаны и важна скорость. Отличается от delegate-task (здесь параллелизм, нет межзадачного ревью-гейта).",
	"Edit and improve documents by restructuring sections, improving clarity, and tightening prose. Use when user wants to edit, revise, restructure, or improve any document — including specs/ files, articles, READMEs, or technical writing.":
		"Редактирование и улучшение документов: перестройка секций, ясность, сжатие текста. Используй для правки любого документа — specs/, статей, README, технической прозы.",
	"Refine a rough idea into a clear, detailed specification through dialogue. Does not produce code. Use when user has a vague idea, wants to think through a feature before planning, or needs to turn \"I want X\" into a concrete spec.":
		"Доработка грубой идеи в чёткую детальную спецификацию через диалог. Код не генерирует. Используй, когда идея vaga, нужно обдумать фичу до планирования или превратить «хочу X» в конкретный spec.",
	"Apply the F.I.R.S.T test quality rubric (per CONVENTIONS.md §Tests) to a test suite or individual tests. Use when develop-tdd is writing tests, when test quality needs to be checked, or when user mentions F.I.R.S.T or \"test quality\".":
		"Применение рубрики качества тестов F.I.R.S.T (по CONVENTIONS.md §Tests) к тест-сьюиту или отдельным тестам. Используй, когда develop-tdd пишет тесты, когда нужно проверить качество тестов или при упоминании F.I.R.S.T / «test quality».",
	"Benchmark-gated skill evolution — consume bigpowers-benchmark report, propose plan-work change, edit skill via craft-skill, re-run benchmark, record ADR. Use when a skill underperforms on benchmark or stocktake finds systemic gap.":
		"Эволюция скиллов с гейтом по бенчмарку — потребление отчёта bigpowers-benchmark, предложение изменения plan-work, правка скилла через craft-skill, повторный бенчмарк, запись ADR. Используй, когда скилл недорабатывает по бенчмарку или stocktake нашёл системную брешь.",
	"Batch-execute tasks from the active epic capsule sequentially, with a human checkpoint after each step. Use when user has an approved plan and wants step-by-step oversight.":
		"Пакетное последовательное выполнение задач из активной капсулы эпика с человеческой контрольной точкой после каждого шага. Используй, когда есть утверждённый план и нужен пошаговый контроль.",
	"Extract a Google DESIGN.md file from an HTML prototype (claude.ai/design or any styled page) using Puppeteer, producing machine-readable tokens and AI-generated prose. Use when the user has an HTML prototype and wants a DESIGN.md to anchor their project's visual identity, or when seed-conventions has just scaffolded a new project.":
		"Извлечение Google DESIGN.md из HTML-прототипа (claude.ai/design или любой стилизованный шаблон) через Puppeteer: machine-readable токены и AI-текст. Используй, когда есть HTML-прототип и нужен DESIGN.md для визуальной идентичности проекта, или после seed-conventions.",
	"Plan a large effort as a shared map of decision tickets on an issue tracker, resolving them one at a time until the way is clear. Use when an idea is too big for one session, needs structured exploration before implementation, or requires mapping decisions before building.":
		"Планирование большого усилия как общей карты тикетов-решений в трекере, решение по одному, пока путь не станет ясен. Используй, когда идея слишком велика для одной сессии, нужна структурированная разведка или карта решений перед сборкой.",
	"Bug fix orchestrator — active_flow fix_bug; reads specs/bugs/BUG-*.md; chains investigate-bug, develop-tdd, validate-fix. Use when user reports a defect.":
		"Оркестратор исправления багов — active_flow fix_bug; читает specs/bugs/BUG-*.md; цепочка investigate-bug, develop-tdd, validate-fix. Используй, когда пользователь сообщает о дефекте.",
	"Deterministic traceability quality gate — reads coverage matrix + blind-spot data, applies decision rules with oracle confidence downgrade, emits PASS/CONCERNS/FAIL/WAIVED verdict. Use before release-branch to gate merges on traceability.":
		"Детерминированный гейт traceability-качества — читает матрицу покрытия + данные о слепых зонах, применяет правила решений с понижением доверия оракула, выдаёт вердикт PASS/CONCERNS/FAIL/WAIVED. Используй перед release-branch для гейта слияний по traceability.",
	"Generate Allure-ready reports from bigpowers YAML metadata. Reads execution-status.yaml, release-plan.yaml, epic capsules, task YAMLs, cycle-times.yaml, and bug registry to produce allure-results/junit-results.xml, categories.json, and executor.json. Use when preparing progress dashboards, integrating with Allure TestOps, or generating CI reports.":
		"Генерация Allure-готовых отчётов из YAML-метаданных bigpowers. Читает execution-status.yaml, release-plan.yaml, капсулы эпиков, task-YAML, cycle-times.yaml и реестр багов, создаёт allure-results/junit-results.xml, categories.json, executor.json. Используй для дашбордов прогресса, интеграции с Allure TestOps или CI-отчётов.",
	"Interactive assumption-surfacing Q&A that stress-tests a plan through relentless questioning until every decision is resolved. Use when user wants to challenge a plan, validate decisions from conversation/context, or mentions \"grill me\". For doc-grounded variant, use grill-with-docs.":
		"Интерактивный Q&A по выносу допущений: стресс-тест плана через relentless-вопросы, пока не решено каждое решение. Используй, когда пользователь хочет проверить план, валидировать решения из разговора/контекста или говорит «grill me». Для doc-варианта — grill-with-docs.",
	"Doc-grounded variant of grill-me — stress-tests plan assumptions by fetching and citing real library or API documentation. Every challenge must cite a real URL. Use when the plan depends on a specific library or external API.":
		"Doc-подкреплённый вариант grill-me — стресс-тест допущений плана с подтягиванием и цитированием реальной документации библиотек/API. Каждый вопрос должен цитировать реальный URL. Используй, когда план зависит от конкретной библиотеки или внешнего API.",
	"Block dangerous git commands (push, force push, reset --hard, clean, branch -D, checkout/restore .) and enforce Conventional Commits & Branch Protection before an AI agent runs them. Installs hook scripts for Claude Code, Cursor, Cursor CLI, and Gemini CLI; documents Google Antigravity Terminal deny lists. Use when the user wants git safety hooks, to block git push or destructive git in agents, or to mirror the same policy across AI coding tools.":
		"Блокировка опасных git-команд (push, force push, reset --hard, clean, branch -D, checkout/restore .) и enforcement Conventional Commits & Branch Protection перед запуском AI-агентом. Устанавливает hook-скрипты для Claude Code, Cursor, Cursor CLI, Gemini CLI; описывает deny-списки Google Antigravity Terminal. Используй для git safety hooks и блокировки деструктивного git в агентах.",
	"Harden a production Linux VPS for your application across three layers — application (systemd hardening, monitoring alerts, backup automation), Ubuntu OS (UFW firewall, fail2ban SSH, unattended-upgrades, SSH hardening), and VPS provider (health checks, daily backups, monthly snapshots). Use when the user wants to secure a production server, harden a VPS, audit server security, or mentions production hardening, VPS security, or harden the server.":
		"Укрепление продакшн Linux VPS в трёх слоях — приложение (systemd hardening, алерты мониторинга, авто-бэкапы), Ubuntu OS (UFW, fail2ban SSH, unattended-upgrades, SSH hardening) и провайдер VPS (health checks, дневные бэкапы, месячные снапшоты). Используй для защиты продакшн-сервера или аудита безопасности VPS.",
	"Set up pre-commit hooks with lint-staged (Prettier), type checking, and tests in the current repo. Use when user wants to add pre-commit hooks, set up Husky, configure lint-staged, or add commit-time formatting/typechecking/testing.":
		"Настройка pre-commit хуков с lint-staged (Prettier), проверкой типов и тестами в текущем репозитории. Используй для добавления pre-commit хуков, Husky, lint-staged или форматирования/типизации/тестов на коммит.",
	"Interactive QA session where user reports bugs or issues conversationally, and the agent logs them to specs/bugs/registry.yaml with a structured audit schema. Explores the codebase in the background for context and domain language. Use when user wants to report bugs, do QA, or mentions \"QA session\".":
		"Интерактивная QA-сессия: пользователь рассказывает о багах, агент логирует их в specs/bugs/registry.yaml со структурированной audit-схемой. В фоне исследует кодовую базу для контекста и доменного языка. Используй для отчётов о багах, QA или «QA session».",
	"Investigate a bug or issue by exploring the codebase to find root cause, then write a TDD-based fix plan to specs/bugs/BUG-*.md. Use when user reports a bug, wants to investigate a problem, mentions \"triage\", or wants to plan a fix.":
		"Расследование бага: исследование кодовой базы ради корневой причины, затем TDD-план исправления в specs/bugs/BUG-*.md. Используй при отчёте о баге, триаже или планировании фикса.",
	"Create an isolated Git worktree/branch or Jujutsu workspace, then verify a clean test baseline before code. Use when starting a feature or task.":
		"Создание изолированного Git worktree/ветки или Jujutsu workspace, затем проверка чистого тест-бейзлайна перед кодом. Используй при старте фичи или задачи.",
	"Agent-maintained OKF wiki — INGEST source docs, LINT for issues, QUERY across concept pages. Run as part of build-epic Step 8 and verify-work Phase 3.":
		"OKF wiki, ведомая агентом — INGEST исходных документов, LINT проблем, QUERY по страницам концептов. Запуск как часть build-epic Step 8 и verify-work Phase 3.",
	"Derives the tech-stack doc from scratch by scanning the codebase — analyzes stack, architecture, and gray areas (error handling, API shapes) and persists findings into specs/tech-architecture/tech-stack.md. Run when the tech doc doesn't exist yet; use survey-context to consume it once it does.":
		"Сведение tech-stack документа с нуля по сканированию кодовой базы — анализ стека, архитектуры и серых зон (ошибки, формы API), сохранение в specs/tech-architecture/tech-stack.md. Запуск, когда tech-документа ещё нет; для потребления используй survey-context.",
	"Detect GSD, spec-kit, or BMAD spec artifacts and transform them into bigpowers YAML layout (state.yaml, release-plan.yaml, epics/, requirements/, plans/, ADRs). Use when migrating foreign spec docs.":
		"Детект GSD, spec-kit или BMAD spec-артефактов и трансформация в YAML-раскладку bigpowers (state.yaml, release-plan.yaml, epics/, requirements/, plans/, ADR). Используй для миграции чужих spec-документов.",
	"Grilling session that challenges your plan against the existing domain model, sharpens terminology, and updates specs/tech-architecture/tech-stack.md and specs/adr/ inline as decisions crystallise. Use when user wants to stress-test a plan against their project's domain language and documented decisions.":
		"Grilling-сессия: проверка плана против существующей доменной модели, точная терминология, inline-обновление specs/tech-architecture/tech-stack.md и specs/adr/ по мере кристаллизации решений. Используй для стресс-теста плана против доменного языка и задокументированных решений проекта.",
	"Meta-skill that enforces the 6-phase core loop (discover → elaborate → plan → build → verify → release) with hard gates. Use to coordinate multi-phase projects with guaranteed quality checkpoints. One-time command for the entire project lifecycle.":
		"Мета-скилл: enforcement 6-фазного цикла (discover → elaborate → plan → build → verify → release) с жёсткими гейтами. Для координации многофазных проектов с гарантированными контрольными точками качества. Одноразовая команда на весь жизненный цикл проекта.",
	"Scans the active workspace for disposable artifacts—logs, caches, stale build output, and stray draft markdown—and proposes consolidation of scattered assets. Produces a reviewable list, asks for explicit confirmation before any delete or move, and optionally revises .gitignore. Use when the user says \"clean my room\", \"organize workspace\", \"workspace cleanup\", \"remove temp files\", \"organize assets\", \"gitignore\", or wants a safe tidy pass.":
		"Сканирование рабочего пространства на одноразовые артефакты — логи, кэши, устаревшие сборки, разбросанные markdown-черновики — и предложение консолидации. Создаёт проверяемый список, просит явное подтверждение перед удалением/перемещением, опционально правит .gitignore. Используй при «clean my room», «organize workspace», «workspace cleanup», «remove temp files», «gitignore».",
	"Create a detailed refactor plan with tiny commits via user interview, then save it as specs/REFACTOR_LATEST.md. Use when user wants to plan a refactor, create a refactoring RFC, or break a refactor into safe incremental steps.":
		"Детальный план рефакторинга с мелкими коммитами через интервью с пользователем, сохранение в specs/REFACTOR_LATEST.md. Используй для планирования рефакторинга, RFC рефакторинга или разбиения на безопасные инкременты.",
	"RELEASE-INDEX BUILDER — Sequence elaborated epics into specs/release-plan.yaml with WSJF ordering and BCP baselines. NOT a planning-spine substitute: it does not scope work (scope-work) or write story tasks (plan-work). Use after elaborate-spec when the user wants a versioned release index of epics.":
		"RELEASE-INDEX BUILDER — упорядочивание elaborated эпиков в specs/release-plan.yaml по WSJF с BCP-бейзлайнами. Не замена planning-spine: не скоупит работу (scope-work) и не пишет story-задачи (plan-work). Используй после elaborate-spec для версионируемого release-индекса эпиков.",
	"Design a risk-scaled test architecture for an epic before implementation begins. Produces prioritized scenarios, test level distribution, and fixture plans based on TEA and bigpowers principles.":
		"Проектирование риск-масштабированной тестовой архитектуры для эпика до начала реализации. Приоритизированные сценарии, распределение по уровням тестов, план фикстур по TEA и принципам bigpowers.",
	"PLANNING SPINE STEP 3 of 3 — Plan the work: write detailed implementation tasks into the active epic capsule (specs/epics/eNN-slug/). Produces countable-story-format .md specs and runnable -tasks.yaml files. Use after slice-tasks (step 2). Not a substitute for scope-work (step 1) or slice-tasks (step 2).":
		"PLANNING SPINE ШАГ 3 из 3 — планирование работы: детальные задачи реализации в активной капсуле эпика (specs/epics/eNN-slug/). Создаёт .md specs в countable-story формате и исполняемые -tasks.yaml. Используй после slice-tasks (шаг 2). Не замена scope-work (шаг 1) или slice-tasks (шаг 2).",
	"Package registry publishing for npm, crates.io, PyPI, and Homebrew. Verifies prerequisites, runs the publish command, confirms success, and surfaces actionable error hints on failure.":
		"Публикация в реестрах: npm, crates.io, PyPI, Homebrew. Проверка предпосылок, публикация, подтверждение успеха, подсказки по ошибкам при неудаче.",
	"Streamlined fast-path for trivial data-only fixes — no TDD, no branching ceremony. Collapses 6 skills into 2 for changes that are purely data with no logic risk. Aborts with fallback to investigate-bug if guardrails trigger.":
		"Упрощённый fast-path для тривиальных data-only правок — без TDD и ветвления. Схлопывает 6 скиллов до 2 для чисто данных изменений без логического риска. При срабатывании guardrails — откат к investigate-bug.",
	"Make the merge/PR/keep/discard decision for a feature branch, verify coverage gates, create the PR with gh, and clean up the worktree. Use when a feature is done and ready to ship, or when user says \"release\", \"merge\", or \"open a PR\".":
		"Решение merge/PR/keep/discard для фичевой ветки, проверка coverage-гейтов, создание PR через gh, уборка worktree. Используй, когда фича готова к шипингу, или «release», «merge», «open a PR».",
	"Dispatch a fresh reviewer agent with a clean context to critique the code after audit-code passes. The reviewer has no shared state with the coding agent and gives a genuine second opinion. Use after audit-code passes, before committing, or when user wants an independent code review.":
		"Запуск свежего ревью-агента с чистым контекстом для критики кода после прохождения audit-code. У ревьюера нет общего состояния с кодинг-агентом — это настоящее второе мнение. Используй после audit-code, перед коммитом или для независимого ревью.",
	"Look-before-build — search registries, repo, existing skills, and web for prior art before implementing. Appends Prior Art to the spec. Use after survey-context and before elaborate-spec, when adding dependencies, or when the task may already be solved.":
		"Look-before-build — поиск по реестрам, репо, существующим скиллам и вебу перед реализацией. Добавляет Prior Art в spec. Используй после survey-context и до elaborate-spec, при добавлении зависимостей или когда задача уже решена.",
	"Restore the project to a known clean state between agent runs or experiments. Use between benchmark runs, after a failed spike, or when user wants a clean working tree.":
		"Возврат проекта в известное чистое состояние между запусками агента или экспериментами. Используй между бенчмарками, после неудачного spike или для чистого working tree.",
	"Act on a reviewer agent's feedback systematically — categorize findings, apply fixes, verify tests still pass. Use after request-review returns a report, or when user wants to work through code review findings.":
		"Системная обработка фидбека ревью-агента — категоризация замечаний, применение фиксов, проверка что тесты проходят. Используй после отчёта request-review или при работе по результатам ревью.",
	"Run skill quality benchmarks from specs/benchmarks/ definitions — N-run with/without-skill delta grading, train/validation split, pass@k + benchmark.json reports. Use before and after evolve-skill to prove quality changes are improvements, not regressions.":
		"Запуск бенчмарков качества скиллов из определений в specs/benchmarks/ — N-прогонов с/без скилла, дельта-грейдинг, train/validation сплит, pass@k + benchmark.json. Используй до и после evolve-skill, чтобы доказать улучшение.",
	"Eval-Driven Development — define capability and regression evals before building; code graders use verify commands, model graders use explicit rubrics; log pass@k. Use before develop-tdd on new features, or when measuring agent capability over runs.":
		"Eval-Driven Development — определение capability и regression evals до сборки; code graders через verify-команды, model graders через явные рубрики; логирование pass@k. Используй перед develop-tdd на новых фичах или для измерения capability агента.",
	"DISCOVER-PHASE ADVANCER — Drive the discover-phase checklist (specs/planning-status.yaml) through survey-context → scope-work → research-first → elaborate-spec → plan-release → slice-tasks. NOT a duplicate of plan-work or the planning spine; it orchestrates the pre-coding discover phase only.":
		"DISCOVER-PHASE ADVANCER — движение discover-чек-листа (specs/planning-status.yaml) через survey-context → scope-work → research-first → elaborate-spec → plan-release → slice-tasks. Не дублирует plan-work или planning spine; оркестрирует только pre-coding discover фазу.",
	"PLANNING SPINE STEP 1 of 3 — Scope the work: define what is in and out of scope and save as specs/product/SCOPE_LATEST.yaml. Use before slice-tasks or plan-release on any new initiative. Not a substitute for slice-tasks (step 2) or plan-work (step 3).":
		"PLANNING SPINE ШАГ 1 из 3 — скоупирование работы: определение in/out of scope и сохранение в specs/product/SCOPE_LATEST.yaml. Используй до slice-tasks или plan-release на любой новой инициативе. Не замена slice-tasks (шаг 2) или plan-work (шаг 3).",
	"Find the right bigpowers skill from natural-language intent using a local lexical index over SKILL.md frontmatter. Use when unsure which skill to invoke, or at start of research-first.":
		"Поиск правильного скилла bigpowers по natural-language намерению через локальный лексический индекс по frontmatter SKILL.md. Используй, когда неясен нужный скилл, или в начале research-first.",
	"AI-powered security analysis of code changes — traces data flow, detects injection, auth bypass, secrets exposure, and unsafe deserialization across files. Use when reviewing pending changes, before release-branch, during verify-work Phase 5, during build-epic Step 0 threat modeling, or when the user says \"security review\" or \"scan for vulns\".":
		"AI-анализ безопасности кодовых изменений — трассировка потока данных, инъекции, обход auth, утечка секретов, небезопасная десериализация между файлами. Используй при ревью незакоммиченных изменений, перед release-branch, в verify-work Phase 5, build-epic Step 0 threat modeling или «security review» / «scan for vulns».",
	"Generate CLAUDE.md and CONVENTIONS.md for a brand-new project through a brief interview, and create the specs/ directory with evolved bigpowers structure (product/, tech-architecture/, verifications/, epics/archive/). Entry point for greenfield projects. Use when starting a new project from scratch, when user asks to set up AI agent conventions, or when there is no CLAUDE.md yet.":
		"Генерация CLAUDE.md и CONVENTIONS.md для нового проекта через короткое интервью, создание specs/ с эволюционированной структурой bigpowers (product/, tech-architecture/, verifications/, epics/archive/). Точка входа для greenfield. Используй для нового проекта, настройки AI-конвенций или когда CLAUDE.md ещё нет.",
	"Track implementation decisions and progress in specs/state.yaml to prevent context rot. Use at the start of a session to load context, and whenever a significant decision is made or a milestone is reached.":
		"Отслеживание решений по реализации и прогресса в specs/state.yaml против context rot. Используй в начале сессии для загрузки контекста и при каждом значимом решении или вехе.",
	"Pre-install dependencies and configure tools before development work begins. Use at session start on a fresh clone, before kickoff-branch, or when user says setup environment or install deps.":
		"Предустановка зависимостей и настройка инструментов до начала разработки. Используй в начале сессии на свежем клоне, перед kickoff-branch или «setup environment» / «install deps».",
	"Write or rewrite technical text with the rules of ASD-STE100 Simplified Technical English so the result is clear, unambiguous, and free of AI slop. Use for documentation, READMEs, runbooks, procedures, error messages, release notes, incident reports, and API guides. Also use when the user says \"STE\", \"Simplified Technical English\", \"ASD-STE100\", \"de-slop\", \"make this readable\", \"write for non-native readers\", or asks for docs that translate well. Enforces the 53 rules of the standard (Issue 9) with a deterministic lint gate.":
		"Написание/перезапись технического текста по правилам ASD-STE100 Simplified Technical English: ясно, без двусмысленностей, без AI slop. Для документации, README, runbooks, процедур, сообщений об ошибках, release notes, инцидент-отчётов, API-гидов. Также при «STE», «de-slop», «make this readable», «write for non-native readers». Enforcement 53 правил стандарта (Issue 9) детерминированным lint-гейтом.",
	"Run Mock User and Auditor agents against a feature in fresh contexts before human review. Use after verify-work, before request-review, when user wants pre-review simulation.":
		"Запуск Mock User и Auditor агентов против фичи в свежих контекстах перед человеческим ревью. Используй после verify-work, перед request-review, для pre-review симуляции.",
	"PLANNING SPINE STEP 2 of 3 — Slice the work: break a scoped PRD into vertical-slice stories in specs/epics/. Use after scope-work (step 1), before plan-work (step 3). Not a substitute for scope-work or plan-work.":
		"PLANNING SPINE ШАГ 2 из 3 — нарезка работы: разбиение скоупированного PRD на vertical-slice сторис в specs/epics/. Используй после scope-work (шаг 1), до plan-work (шаг 3). Не замена scope-work или plan-work.",
	"Post-deploy health-check against a live URL. Validates HTTP status, response content, and critical endpoints. Runnable standalone OR as the final step of the deploy skill.":
		"Post-deploy health-check против живого URL. Валидация HTTP-статуса, контента ответа, критичных эндпоинтов. Запуск standalone или как финальный шаг deploy-скилла.",
	"Throw-away prototype for unknown problem spaces. Output is learning notes in specs/archive/spikes/SPIKE-<name>.md, not production code. Use when the domain or technology is unexplored, when estimates are impossible without experimentation, or when user says \"spike\", \"prototype\", or \"proof of concept\".":
		"Одноразовый прототип для неизученных областей. Результат — заметки об уроках в specs/archive/spikes/SPIKE-<name>.md, не продакшн-код. Используй, когда домен/технология неизучены, оценки невозможны без экспериментов, или «spike», «prototype», «proof of concept».",
	"Sequential subagent batch audit of the bigpowers skill catalog — Quick Scan (changed only) or Full (all skills). Use during sustain phase, before a major release, or when catalog drift is suspected.":
		"Последовательный батч-аудит каталога скиллов bigpowers субагентами — Quick Scan (только изменённые) или Full (все скиллы). Используй в sustain-фазе, перед крупным релизом или при подозрении на дрейф каталога.",
	"Per-task context bootstrap — reads existing specs/ and tech-architecture docs to map the current lifecycle phase and suggest the next skill. Use at the start of any task, when returning after a break, or when unsure what to do next. For deriving a tech-stack doc from scratch, use map-codebase first.":
		"Per-task контекст-бутстрап — чтение существующих specs/ и tech-architecture документов для определения текущей фазы жизненного цикла и предложения следующего скилла. Используй в начале любой задачи, после перерыва или когда неясно что делать дальше. Для сведения tech-stack с нуля — сначала map-codebase.",
	"Fallback ultra-compressed communication mode. Cuts token usage ~75% by dropping filler, articles, and pleasantries while keeping full technical accuracy. Use ONLY when context is critically long and compressing output is necessary to continue. Not a strategy — token discipline comes from code shape (small functions, unique names, headless tests), not terser prompts. Use when user says \"caveman mode\", \"terse mode\", \"less tokens\", \"be brief\", or invokes /terse-mode.":
		"Запасной ультра-сжатый режим коммуникации. Срезает токены ~75% без потери технической точности. Используй ТОЛЬКО, когда контекст критически длинный и без сжатия не продолжить. Не стратегия — дисциплина токенов идёт из формы кода (малые функции, уникальные имена, headless тесты). При «caveman mode», «terse mode», «less tokens», «be brief» или /terse-mode.",
	"Link story IDs from specs/release-plan.yaml + epic capsule directories to the implementing code and tests. Produces specs/TRACEABILITY_LATEST.md. Use when you want to verify coverage of a release plan, audit which stories are implemented, or find \"dark\" stories with no code.":
		"Связывание ID сторис из specs/release-plan.yaml + капсул эпиков с кодом и тестами. Создаёт specs/TRACEABILITY_LATEST.md. Используй для проверки покрытия release-плана, аудита реализованных сторис или поиска «тёмных» сторис без кода.",
	"One-time bootstrap that introduces the bigpowers skills system, the PMBOK lifecycle arc, and tells you which skill to call first for your situation. Use when starting with bigpowers for the first time, when user asks \"where do I start?\", or when the skills system needs to be explained.":
		"Одноразовый бутстрап: знакомит с системой скиллов bigpowers, дугой жизненного цикла PMBOK, и говорит какой скилл вызывать первым. Используй при первом знакомстве с bigpowers, «where do I start?» или когда нужно объяснить систему скиллов.",
	"Assert data shape consistency across system boundaries — live API responses against JSON Schema, key-set comparison across layers, data shape validation for migrations and exports. Catches silent data corruption before deploy.":
		"Проверка консистентности формы данных на границах систем — live API-ответы против JSON Schema, сравнение наборов ключей между слоями, валидация форм для миграций и экспортов. Поймает тихое порожение данных до деплоя.",
	"Prove a fix works before declaring done — re-run the failing test, run the full suite, typecheck, lint, and harden against recurrence. Use after implementing a bug fix, when user says \"is this fixed?\", or before closing an investigation.":
		"Доказательство работы фикса до «готово» — перезапуск упавшего теста, полный сьют, typecheck, lint, укрепление от рекурренции. Используй после реализации фикса, «is this fixed?» или перед закрытием расследования.",
	"Multi-phase UAT gate — cold-start smoke, build, typecheck, lint, tests, step-by-step manual verification, gaps-closure loop. Use after execute-plan or develop-tdd, before audit-code.":
		"Многофазный UAT-гейт — cold-start smoke, сборка, typecheck, lint, тесты, пошаговая ручная проверка, цикл закрытия разрывов. Используй после execute-plan или develop-tdd, перед audit-code.",
	"Start a browser-based dashboard that visualizes architecture, implementation plans, and project status. Persists artifacts in .bigpowers/dashboard/. Reads specs/state.yaml, release-plan.yaml, epics, and planning-status via HTTP API or opencode panel.":
		"Браузерный дашборд: визуализация архитектуры, планов реализации, статуса проекта. Артефакты в .bigpowers/dashboard/. Читает specs/state.yaml, release-plan.yaml, epics, planning-status через HTTP API или opencode панель.",
	"CI pipeline setup with bundled, forge-neutral templates and local validation. Detects the forge from the git remote, generates workflows for supported forges, and skips honestly for the rest. The CI equivalent of wire-observability.":
		"Настройка CI-конвейера с встроенными forge-neutral шаблонами и локальной валидацией. Детект форджа из git remote, генерация workflow для поддерживаемых, честный skip для остальных. CI-аналог wire-observability.",
	"Add structured JSON logging, observability commands, and idempotent setup scripts to a project. Use when a project needs production-readiness instrumentation, when user wants structured logging, or as a production-readiness gate at any phase of development.":
		"Добавление структурированного JSON-логирования, observability-команд и идемпотентных setup-скриптов в проект. Используй для production-readiness инструментирования или как production-гейт на любой фазе.",
	"Write, organize, and sync high-integrity technical documents using the BMAD methodology. Ensures every document is Bold, Minimal, Actionable, and Durable. Use when creating architectural docs, technical guides, or organizing the specs/ directory.":
		"Написание, организация и синхронизация high-integrity технических документов по методологии BMAD. Каждый документ — Bold, Minimal, Actionable, Durable. Используй для архитектурных документов, технических гидов, наведения порядка в specs/.",
	// pi-lens
	"Use when searching or replacing code patterns - use ast-grep instead of text search for semantic accuracy":
		"Используй при поиске или замене кодовых паттернов — ast-grep вместо текстового поиска ради семантической точности",
	"Navigate code with IDE features and run proactive LSP diagnostics on files/folders/batches. Use as PRIMARY for code intelligence and type/error checks.":
		"Навигация по коду IDE-фичами и proactive LSP-диагностика файлов/папок/батчей. Основной инструмент для code intelligence и проверки типов/ошибок.",
	"Use when writing a new pi-lens ast-grep rule YAML file — covers schema, drop path, gotchas, and NAPI runner constraints":
		"Используй при написании нового YAML-правила ast-grep для pi-lens — схема, drop path, грабли и ограничения NAPI-раннера",
	"Use when writing a new pi-lens tree-sitter query rule YAML file — covers schema, S-expression syntax, capture names, predicates, and gotchas":
		"Используй при написании нового YAML-правила tree-sitter query для pi-lens — схема, S-expression синтаксис, имена capture, предикаты и грабли",
	// pi-prompt-template-model (YAML блок-скаляр | — с переносами)
	"Write and run custom Pi prompt templates (slash commands) for this extension.\nUse when creating templates with model selection, deterministic pre-steps,\nloops, chains, subagents, or best-of-N compare flows.":
		"Написание и запуск кастомных Pi prompt-шаблонов (slash-команд) для этого расширения.\nИспользуй при создании шаблонов с выбором модели, детерминированными pre-steps,\nциклами, цепочками, субагентами или best-of-N compare flow.",
	// @bacnh85/pi-obsidian (YAML >- — строки слиты в пробел)
	"Enforce using the Obsidian tool (not bash) for all vault file operations. Trigger whenever the user mentions Obsidian, vault, notes, moving files in the vault, archiving notes, or any file operation inside an Obsidian vault path. Also trigger when the agent is about to use bash mv/cp/rm/rename on paths containing \"obsidian\", \"hermes\", \"vault\", \".obsidian\", or similar vault indicators. Agents commonly default to bash for file operations — this skill prevents that mistake. Use BEFORE any file operation when vault paths are involved.":
		"Enforcement использования инструмента Obsidian (не bash) для всех операций с файлами vault. Триггер, когда пользователь упоминает Obsidian, vault, заметки, перемещение файлов в vault, архивацию заметок или любую файловую операцию внутри пути Obsidian vault. Также когда агент собирается bash mv/cp/rm/rename по путям с \"obsidian\", \"hermes\", \"vault\", \".obsidian\" или похожими vault-маркерами. Агенты по умолчанию лезут в bash — этот скилл предотвращает ошибку. Используй ПЕРЕД любой файловой операцией при vault-путях.",
	// @plannotator
	"Reference for using Plannotator (its `plannotator` tool when you have one, otherwise the CLI): plan review, code review, annotating files, URLs, folders, and running local apps, annotating the last assistant message, browsing archived plan decisions, exporting or sharing Guided Reviews, and the Plannotator Inbox (messages and questions the person answers later, without blocking you). Invoke when asked to use Plannotator for anything not covered by a more specific plannotator-* skill, and before you leave the person a decision, a question or finished work in the Plannotator Inbox (if another agent started you, report to it instead).":
		"Референс по Plannotator (его инструмент `plannotator`, если он есть, иначе CLI): ревью плана, ревью кода, аннотирование файлов, URL, папок, запуск локальных приложений, аннотирование последнего сообщения ассистента, просмотр архивных решений плана, экспорт/шаринг Guided Reviews и Plannotator Inbox (сообщения и вопросы, на которые человек отвечает позже, без блокировки). Вызывай, когда просят Plannotator для того, что не покрывает более специфичный plannotator-* скилл, и перед тем как оставить человеку решение, вопрос или готовую работу в Plannotator Inbox (если тебя запустил другой агент — доложи ему).",
	// pi-file-tree-browser
	"Investigate a codebase task, narrow findings to a short curated list of relevant file locations, and send them to the file browser with set_file_browser_results so the user can inspect and pin them.":
		"Расследовать задачу в кодовой базе, сжать находки в короткий отобранный список местоположений файлов и отправить их в файловый браузер через set_file_browser_results, чтобы пользователь мог их просмотреть и зафиксировать.",
	// === Команды расширений pi.dev (registerCommand) ===
	// pi-web-access
	"Open web search curator": "Открыть web-поисковый куратор",
	"Toggle or configure the search curator workflow": "Вкл/выкл и настройка workflow поискового куратора",
	"Show the active Google account for Gemini Web": "Активный Google-аккаунт для Gemini Web",
	"Browse stored web search results": "Просмотр сохранённых результатов web-поиска",
	"Enable configured pi-web-access tools for web research and content retrieval. Does not search or fetch. Enabled tools are available on the next model request; disabled capabilities remain unavailable.": "Включить настроенные инструменты pi-web-access для веб-исследований и получения контента. Не выполняет поиск и fetch. Включённые инструменты доступны при следующем запросе модели; отключённые возможности остаются недоступны.",
	"Web search, URL fetching, GitHub repo cloning, PDF extraction, YouTube video understanding, and local video analysis for Pi coding agent. Supports OpenAI, Brave, Parallel, TinyFish, Search1API, Searchinfinity, Querit, Tavily, Firecrawl, Crawl4AI, Jina, SERPdive, Kagi, Ollama, AnySearch, Bright Data SERP, SerpBase, SerpApi, Serply, SearchApi, Outcrawl, Sofya, cloro, Autom, SpecStream, You.com, SearXNG, degoog, Exa, Perplexity, Gemini, Kimi, Mistral, and Tabstack.": "Веб-поиск, загрузка URL, клонирование GitHub-репо, извлечение PDF, понимание видео YouTube и анализ локальных видео для Pi coding agent. Поддержка: OpenAI, Brave, Parallel, TinyFish, Search1API, Searchinfinity, Querit, Tavily, Firecrawl, Crawl4AI, Jina, SERPdive, Kagi, Ollama, AnySearch, Bright Data SERP, SerpBase, SerpApi, Serply, SearchApi, Outcrawl, Sofya, cloro, Autom, SpecStream, You.com, SearXNG, degoog, Exa, Perplexity, Gemini, Kimi, Mistral, Tabstack.",
	// pi-lsp-extension
	"Show LSP server status": "Статус LSP-сервера",
	"Restart an LSP server: /lsp-restart <language> (e.g. java, typescript)": "Перезапуск LSP-сервера: /lsp-restart <language> (напр. java, typescript)",
	"Configure an LSP server: /lsp-config <language> <command> [args...]": "Настройка LSP-сервера: /lsp-config <language> <command> [args...]",
	"Set Lombok jar path for Java: /lsp-lombok <path-to-lombok.jar>": "Путь к Lombok jar для Java: /lsp-lombok <path-to-lombok.jar>",
	// pi-fff
	"Toggle pi-fff features on or off": "Вкл/выкл функции pi-fff",
	"Trigger an fff rescan for the current project": "Rescan fff для текущего проекта",
	"Show fff runtime status and index health": "Статус fff runtime и здоровье индекса",
	// pi-lens
	"Toggle pi-lens on/off for the current session. Usage: /lens-toggle": "Вкл/выкл pi-lens для текущей сессии. Использование: /lens-toggle",
	"Toggle automatic context injection on/off for the current session (tools/LSP/read-guard/formatting stay active). Usage: /lens-context-toggle": "Вкл/выкл автоинъекцию контекста (tools/LSP/read-guard/formatting остаются активны). Использование: /lens-context-toggle",
	"Show or hide the pi-lens diagnostics widget below the editor. Usage: /lens-widget-toggle": "Показать/скрыть виджет диагностики pi-lens под редактором. Использование: /lens-widget-toggle",
	"Show Technical Debt Index (TDI) and project health trend. Usage: /lens-tdi": "Technical Debt Index (TDI) и тренд здоровья проекта. Использование: /lens-tdi",
	"Render the review graph as a self-contained interactive HTML project map (pan/zoom/hover/click) and write it to disk. Usage: /lens-map": "Интерактивная HTML-карта проекта из review-графа (pan/zoom/hover/click), записывается на диск. Использование: /lens-map",
	"Show pi-lens runtime health: pipeline crashes, slow runners, and last dispatch latency. Usage: /lens-health": "Здоровье pi-lens runtime: крахи pipeline, медленные runners, латентность dispatch. Использование: /lens-health",
	"Show the slowest latency-log phases by p50 and p99 for the current process session and machine-wide active log window. Usage: /lens-perf": "Самые медленные фазы latency-log по p50/p99 для сессии процесса и активного log-окна машины. Использование: /lens-perf",
	"Show pi-lens tool installation status: globally installed, auto-installed, or npx fallback. Usage: /lens-tools": "Статус установки инструментов pi-lens: глобально, автоустановлено, npx fallback. Использование: /lens-tools",
	"Allow one edit to a file without a prior read. Usage: /lens-allow-edit <path>": "Разрешить одну правку файла без предварительного read. Использование: /lens-allow-edit <path>",
"Run automatic formatting immediately after each write/edit instead of deferring to agent_end. Also via format.mode=\"immediate\" in config.": "Автоматическое форматирование сразу после каждой write/edit, без отложенного agent_end. Также через format.mode=\"immediate\" в config.",
	"Keep every pi-lens tool active for the whole session. Same as tools.lazy=false in ~/.pi-lens/config.json; the default tools.lazy=true starts the situational tools inactive on every model, and tools.lazy=\"auto\" only on models that support mid-conversation system messages.": "Все инструменты pi-lens активны всю сессию. То же, что tools.lazy=false в ~/.pi-lens/config.json; по умолчанию tools.lazy=true включает situational-инструменты неактивными на всех моделях, tools.lazy=\"auto\" — только на моделях с поддержкой system-сообщений в середине диалога.",
	"Query pi-lens diagnostics from the session cache or an active LSP probe, at paths or workspace scope. Empty cache is not proof of clean; probe changed paths when findings are absent or stale. Example:": "Диагностика pi-lens из кеша сессии или активного LSP-проба, по путям или по workspace. Пустой кеш — не доказательство чистоты; для изменённых путей делай probe. Пример:",
	"Find and rewrite code by AST structure; preview by default. Example:": "Поиск и переписывание кода по AST-структуре; по умолчанию preview. Пример:",
	"Navigate source with language-server operations such as definition, references, hover, and rename. Returns Neovim-style TEXT by default (path:line:col locations, symbol trees, diagnostics); pass view:\"json\" for the structured envelope. Example: use": "Навигация по исходникам через операции language-server: definition, references, hover, rename. По умолчанию Neovim-style TEXT (path:line:col, деревья символов, диагностика); view:\"json\" — структурированный оверлей. Пример:",
	"Output format. \"json\" returns the structured envelope (machine-readable, byte-identical to the pre-text default); any other value (or omitting view) returns the default Neovim-style TEXT rendering (path:line:col locations, symbol trees, diagnostics).": "Формат вывода. \"json\" — структурированный оверлей (машиночитаемый, побайтово как старый дефолт); любое другое значение (или без view) — Neovim-style TEXT (path:line:col, деревья символов, диагностика).",
	"Output preset: projection × format. \"summary-text\" (default) = metric fields off (no usedBy/fanout/complexity fields), text. \"summary-json\" = same fields, JSON. \"full-text\" = every field, text. \"full-json\" = every field, JSON (byte-identical to the pre-#5137 default). Metrics render as a cx:/fan: suffix and flags as [flag]; every field appears in the text cell,": "Пресет вывода: проекция × формат. \"summary-text\" (default) = без полей метрик (usedBy/fanout/complexity), текст. \"summary-json\" = те же поля, JSON. \"full-text\" = все поля, текст. \"full-json\" = все поля, JSON (побайтово как дефолт до #5137). Метрики — суффикс cx:/fan:, флаги — [flag]; каждое поле в текстовой ячейке,",
	"Orient in a project from its review graph, with ranked hubs and entry points. Returns a line-oriented TEXT report by default; pass view:\"json\" for the full JSON payload. On a cold cache, project_report and symbol_search return available: false with a retry hint and start a non-blocking background build; module_report degrades to outline-only with cache freshness explicit. Example: use project_report before module_report when the target file is unknown.": "Ориентация в проекте по review-графу: ранжированные хаб-файлы и точки входа. По умолчанию текстовый отчёт; view:\"json\" — полный JSON. При холодном кеше project_report и symbol_search возвращают available: false с hint и запускают фоновую сборку; module_report деградирует до outline-only с пометкой свежести кеша. Пример: project_report до module_report, если целевой файл неизвестен.",
	"Payload tier. \"json\" (or any \"*-json\" preset name) returns the full JSON report; any other value (or omitting view) returns the default line-oriented TEXT rendering.": "Уровень payload. \"json\" (или любое имя пресета \"*-json\") — полный JSON-отчёт; любое другое значение (или без view) — текстовая отрисовка по умолчанию.",
// @plannotator/pi-extension
	"Toggle plannotator planning mode": "Переключить planning-режим plannotator",
	"Open interactive code review for current changes, a directory, or a PR URL; pass --git or --gitbutler to force that provider, --base <ref> / --diff-type <type> to pin the session's opening diff": "Интерактивный code review: текущие изменения, каталог или PR URL; --git/--gitbutler — форс-провайдер, --base <ref> / --diff-type <type> — зафиксировать opening diff сессии",
	"Open a file, several files, a URL or a folder in the annotation UI": "Открыть файл(ы), URL или папку в annotation UI",
	"Annotate the last assistant message": "Аннотировать последнее сообщение ассистента",
	"Open the Plannotator Inbox in the browser, show its address, and brief the agent on it": "Открыть Plannotator Inbox в браузере, показать адрес и проинструктировать агента",
	"Reload Pi to load the updated Plannotator (the same as /reload)": "Перезагрузить Pi для подгрузки обновлённого Plannotator (то же, что /reload)",
	"Start in plan mode (restricted exploration and planning)": "Старт в plan-режиме (ограниченное исследование и планирование)",
	// pi-code-previews
	"Show code preview renderer health and settings": "Здоровье и настройки рендерера code preview",
	"Configure code preview settings": "Настройки code preview",
	// mcp (встроенное расширение)
	"Manage MCP servers: sign in, reconnect, enable or disable, and change exposure": "Управление MCP-серверами: вход, реконнект, вкл/выкл, смена exposure",
	// pi-hashline-edit-pro
	"Open the hashline settings window (auto-read, diff context, auto-read all, git repos only, ignore folders/files, grep, copy/move, replace_match, outline, path, strict input, disable on models, read on disabled models)": "Окно настроек hashline (auto-read, diff-контекст, auto-read all, только git-репо, игнор папок/файлов, grep, copy/move, replace_match, outline, path, строгий ввод, отключение на моделях, read на отключённых)",
	"Clear the session's anchor claims (path-free resolution state); anchors are re-claimed on the next read": "Очистить anchor-притязания сессии (path-free состояние); anchors зачислятся заново при следующем read",
	// pi-prompt-template-model
	"Chain prompt templates sequentially [template -> template -> ...]": "Цепочка prompt-шаблонов последовательно [template -> template -> ...]",
	"Manage the run-prompt tool (agent-accessible prompt execution)": "Управление инструментом run-prompt (выполнение промтов агентом)",
	// === Шорткаты расширений pi.dev (registerShortcut) ===
	// @plannotator/pi-extension
	"Toggle plannotator": "Переключить plannotator",
	// pi-web-access
	"Review search results": "Просмотреть результаты поиска",
	"Toggle web search activity": "Показать/скрыть виджет активности веб-поиска",
};

// ---------------------------------------------------------------------------
// Частичные (подстроковые) переводы: [фрагмент, замена, caseSensitive?]
// ---------------------------------------------------------------------------
const RUS_PARTIAL: Array<[string, string, boolean?]> = [
	["update available", "доступно обновление"],
	["updates available", "доступны обновления"],
["new version", "новая версия"],
	// === pi-lens 4.5.0: аргументы инструментов (шаблонные строки — частичные) ===
	["Files or directories to filter. ${PATHS_GLOB_CLAUSE}", "Файлы или каталоги для фильтра. ${PATHS_GLOB_CLAUSE}"],
	["Specific files/folders. ${PATHS_GLOB_CLAUSE}", "Конкретные файлы/папки. ${PATHS_GLOB_CLAUSE}"],
	["Files or directories to search. ${PATHS_GLOB_CLAUSE}", "Файлы или каталоги для поиска. ${PATHS_GLOB_CLAUSE}"],
	["Files or directories to outline (workspace-relative or absolute). ${PATHS_GLOB_CLAUSE}", "Файлы или каталоги для outline (относительно workspace или абсолютные). ${PATHS_GLOB_CLAUSE}"],
	["Files, directories or globs scoping hits to matching files (a bare directory entry scopes its whole subtree). ${PATHS_GLOB_CLAUSE}", "Файлы, каталоги или globs для ограничения попаданий (обычная папка ограничивает всю поддерево). ${PATHS_GLOB_CLAUSE}"],
	["Keep only these symbol types, e.g. [\"class\",\"function\"].", "Оставить только эти типы символов, напр. [\"class\",\"function\"]."],
	["Include/exclude file globs for directory input, e.g. [\"*.ts\",\"!**/dist/**\"].", "Globs включения/исключения файлов при папке на входе, напр. [\"*.ts\",\"!**/dist/**\"]."],
	// === Slash-команды: описания (в бандле свой BUILTIN_SLASH_COMMANDS,
	// точные ключи не совпадают из-за паддинга и prefix'а hint'а — частичные) ===
	["Open settings menu", "Открыть меню настроек", true],
	["Select model (opens selector UI)", "Выбрать модель (открывает селектор)", true],
	["Navigate session tree (switch branches)", "Дерево сессии (переключение веток)", true],
	["Set thinking level", "Задать уровень мышления", true],
	["Enable/disable models for Ctrl+P cycling", "Вкл/выкл модели для цикла Ctrl+P", true],
	["Export session (HTML default, or specify path: .html/.jsonl)", "Экспорт сессии (по умолчанию HTML, или путь: .html/.jsonl)", true],
	["Import a JSONL session, preserving its ID and working directory", "Импорт JSONL-сессии с сохранением ID и рабочей папки", true],
	["Share session via a Radius artifact or a GitHub gist", "Шаринг сессии через Radius или GitHub gist", true],
	["Report a bug to the Pi developers", "Сообщить об ошибке разработчикам Pi", true],
	["Copy last agent message to clipboard", "Копировать последнее сообщение агента", true],
	["Set session display name", "Задать имя сессии", true],
	["Show session info and stats", "Информация и статистика сессии", true],
	["Show changelog entries", "Показать записи changelog", true],
	["Show all keyboard shortcuts", "Показать все горячие клавиши", true],
	["Create a new fork from a previous user message", "Новое ветвление от предыдущего сообщения", true],
	["Duplicate the current session at the current position", "Дублировать сессию в текущей позиции", true],
	["Save project trust decision for future sessions", "Сохранить решение о доверии проекта", true],
	["Configure provider authentication", "Настроить авторизацию провайдера", true],
	["Remove provider authentication", "Убрать авторизацию провайдера", true],
	["Start a new session (cmd)", "Новая сессия", true],
	["Manually compact the session context", "Ручное сжатие контекста сессии", true],
	["Resume another session", "Возобновить другую сессию", true],
	["Reload keybindings, extensions, skills, prompts, themes, and context files", "Перезагрузка клавиш, расширений, скиллов, промтов, тем, контекстных файлов", true],
	["Quit pi", "Выход из pi", true],
	["Thinking level: ", "Уровень мышления: "],
	["Default thinking level: ", "Уровень мышления по умолчанию: "],
	// === Настройки: лейблы (case-sensitive, чтобы не бить по нижнему регистру
	// в описаниях; «Skill commands» ДО « skill»/« skills», иначе «скилл commands») ===
	["Skill commands", "Команды скиллов", true],
	["Autocomplete max items", "Максимум элементов автодополнения", true],
	["Auto-resize images", "Авто-ресайз изображений", true],
	// Статус-строки сжатия: ДО «Auto-compact», иначе «Auto-compacting» → «Авто-сжатиеing»
	["Context overflow detected, ", "Обнаружено переполнение контекста, "],
	["Auto-compacting...", "Авто-сжатие..."],
	["Compacting context...", "Сжатие контекста..."],
	["Summarizing branch...", "Суммаризация ветки..."],
	["(escape to cancel)", "(Esc — отмена)"],
	["(esc to cancel)", "(Esc — отмена)"],
	["Retrying (", "Повтор ("],
	["Auto-compact", "Авто-сжатие", true],
	["Block images", "Блокировать изображения", true],
	["Show hardware cursor", "Аппаратный курсор", true],
	["Show images", "Показывать изображения", true],
	["Image width", "Ширина изображений", true],
	["Editor padding", "Отступ редактора", true],
	["Output padding", "Отступ вывода", true],
	["Clear on shrink", "Очистка при сжатии", true],
	["Terminal progress", "Прогресс в терминале", true],
	["Steering mode", "Режим управления", true],
	["Follow-up mode", "Режим follow-up", true],
	["Session share destination", "Адрес шаринга сессий", true],
	["HTTP idle timeout", "HTTP idle-тайм-аут", true],
	["Cache warming", "Прогрев кэша", true],
	["Cache miss notices", "Уведомления о пропусках кэша", true],
	["Collapse changelog", "Сворачивать changelog", true],
	["Quiet startup", "Тихий запуск", true],
	["Install telemetry", "Установить телеметрию", true],
	["Default project trust", "Доверие к проекту по умолчанию", true],
	["Double-escape action", "Действие двойного Esc", true],
	["Tree filter mode", "Режим фильтра дерева", true],
	["Default thinking level per model", "Мышление по умолчанию для моделей", true],
	["TUI mode", "Режим TUI", true],
	["Fullscreen exit output", "Вывод при выходе из полноэкранного", true],
	["Fullscreen scrollbar", "Скроллбар в полноэкранном режиме", true],
	["Fullscreen copy on select", "Копирование при выделении (полноэкранный)", true],
	["Fullscreen wheel scrolling", "Колесо мыши в полноэкранном режиме", true],
	["Mermaid diagrams", "Диаграммы Mermaid", true],
	["Hide thinking", "Скрывать мышление", true],
	["Warnings", "Предупреждения", true],
	["Transport", "Транспорт", true],
	["Automatic Theme", "Автоматическая тема", true],
	["Themes", "Темы", true],
	["Theme", "Тема", true],
	["no sessions found", "сессии не найдены"],
	["no sessions in current folder", "нет сессий в текущей папке"],
	["press tab to view all", "Tab — показать все"],
	// Титульная страница (welcome) — точные фрагменты
	["Welcome back!", "С возвращением!"],
	["Tips", "Подсказки"],
	["Loaded", "Загружено"],
	["Recent sessions", "Недавние сессии"],
	["No recent sessions", "Нет недавних сессий"],
	[" for commands", " для команд"],
	[" to run bash", " запустить bash"],
	[" cycle thinking", " цикл мышления"],
	[" initial prompt tokens", " токенов начального промта"],
	[" press any key to continue", " нажмите любую клавишу для продолжения"],
	// Счётчики (welcome)
	[" skills", " скиллов"],
	[" skill", " скилл"],
	[" prompt templates", " шаблонов промта"],
	[" prompt template", " шаблон промта"],
	[" context files", " контекстных файла"],
	[" context file", " контекстный файл"],
	// Время (welcome)
	["d ago", "дн назад"],
	["h ago", "ч назад"],
	["m ago", "мин назад"],
	["just now", "только что"],
	// Подсказки настроек (settings-list)
	["Type to search", "Введите для поиска"],
	["Enter/Space to change", "Enter/Пробел — сменить"],
	["Esc to cancel", "Esc — отмена"],
	["No settings available", "Нет доступных настроек"],
	["No matching settings", "Нет подходящих настроек"],
	["Press any key to continue", "Нажмите любую клавишу для продолжения"],
	// Динамические строки настроек (шаблоны с подстановкой значений)
	["Thinking Level for ", "Уровень мышления для "],
	["Revert to global default", "Возврат к глобальному значению по умолчанию"],
	["Override the default thinking level for specific models", "Переопределение уровня мышления для конкретных моделей", true],
	[" queues follow-up messages until agent stops. 'one-at-a-time': deliver one, wait for response. 'all': deliver all at once.", " ставит follow-up сообщения в очередь, пока агент работает. 'one-at-a-time': по одному; 'all': все сразу."],
	["configured", "настроено"],
	[" to set as default", " сделать по умолчанию"],
	[" to select", " выбрать"],
	[" to save to settings", " сохранить в настройках"],
	["Took ", "Заняло "],
];

// ---------------------------------------------------------------------------
// Перевод строки
// ---------------------------------------------------------------------------
function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Видимая ширина строки (без ANSI-кодов и \r). Для UI-строк pi достаточно
// посчитать кодовые точки: кириллица и box-drawing — узкие символы.
function visWidth(s: string): number {
	const stripped = s.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "").replace(/\r/g, "");
	let w = 0;
	for (const _ch of stripped) w += 1;
	return w;
}

// Кэш переводов строк: welcome-экран перерисовывается ~30 раз/с,
// строки стабильны — не переводим дважды.
const ruCache = new Map<string, string>();
const RU_CACHE_MAX = 8000;

// Перевод ОДНОЙ строки (без \n).
function ruLine(v: string): string {
	const cached = ruCache.get(v);
	if (cached !== undefined) return cached;
	const remember = (t: string): string => {
		if (ruCache.size >= RU_CACHE_MAX) ruCache.clear();
		ruCache.set(v, t);
		return t;
	};

	const exact = RUS[v];
	if (exact) return remember(exact);

	// Точное совпадение по обрезанной строке: для строк с паддингом
	// ("Skill commands      " — лейбл настроек, "  description" — описание).
	// Паддинг восстанавливается, чтобы колонки оставались выровнены.
	if (v.length > 1) {
		const trimmed = v.trim();
		if (trimmed.length > 0 && trimmed !== v) {
			const t = RUS[trimmed];
			if (t) {
				const lead = v.slice(0, v.length - v.trimStart().length);
				let out = lead + t;
				const target = visWidth(v);
				const w = visWidth(out);
				if (w < target) out += " ".repeat(target - w);
				return remember(out);
			}
		}
	}

	// Быстрый выход: если в строке нет ни одного известного фрагмента — не тратим время
	let hasAny = false;
	for (const [from] of RUS_PARTIAL) {
		if (v.toLowerCase().includes(from.toLowerCase())) { hasAny = true; break; }
	}
	if (!hasAny) return remember(v);

	let out = v;
	for (const [from, to, caseSensitive] of RUS_PARTIAL) {
		if (caseSensitive) {
			if (out.includes(from)) out = out.split(from).join(to);
		} else if (out.toLowerCase().includes(from.toLowerCase())) {
			out = out.replace(new RegExp(escapeRegExp(from), "gi"), to);
		}
	}
	return remember(out);
}

// Перевод строки (в т.ч. мультисстроковой): мультисстроковые чанки
// обрабатываются ПОСТРОЧНО — иначе точные ключи словаря не срабатывают
// на строках внутри чанка (например, описание настройки в /settings).
function ru(v: string): string {
	if (v.indexOf("\n") === -1) return ruLine(v);
	const lines = v.split("\n");
	let changed = false;
	for (let i = 0; i < lines.length; i++) {
		const t = ruLine(lines[i]);
		if (t !== lines[i]) { lines[i] = t; changed = true; }
	}
	return changed ? lines.join("\n") : v;
}

// Перевод описания пункта списка: отрезаем тег источника "[u:npm:bigpowers] ",
// переводим сам текст, возвращаем тег (тег в словаре не значится).
function ruDesc(d: string): string {
	const m = /^\[([^\]\n]+)\] ?/.exec(d);
	if (m) return m[0] + ru(d.slice(m[0].length));
	return ru(d);
}

// Символы замыкающей/боковой рамки боксов (welcome, диалоги).
const BORDER_CHARS = "│┃┇┄┆┈┤┥┙├┝┯┬┴┼┘┐╯╮╰╭║═╔╗╚╝╠╣╦╩╬";

// Восстановление ширины строки после перевода — ТОЛЬКО для строк боксов
// (в оригинале есть рамочный символ): правая граница welcome-бокса не «съезжает».
// Обычные строки (статусы, подсказки) переводятся «как есть» — паддинг
// внутри строки выглядел бы как случайный разрыв. При переполнении замыкающий
// символ рамки на конце строки сохраняется: усекается контент, не рамка.
function adjustLineWidth(orig: string, translated: string): string {
	if (translated === orig) return translated;
	let isBoxLine = false;
	for (const c of BORDER_CHARS) {
		if (orig.includes(c)) { isBoxLine = true; break; }
	}
	if (!isBoxLine) return translated;
	const diff = visWidth(translated) - visWidth(orig);
	if (diff === 0) return translated;
	const re = / +/g;
	let m: RegExpExecArray | null;
	let best = -1;
	let bestLen = 0;
	while ((m = re.exec(translated)) !== null) {
		if (m[0].length > bestLen) { bestLen = m[0].length; best = m.index; }
	}
	if (diff > 0) {
		if (best >= 0 && bestLen >= diff) {
			return translated.slice(0, best) + " ".repeat(bestLen - diff) + translated.slice(best + bestLen);
		}
		const last = translated.slice(-1);
		if (BORDER_CHARS.includes(last)) {
			const content = translated.slice(0, -1);
			const avail = visWidth(orig) - 1;
			if (visWidth(content) > avail) {
				return content.slice(0, avail) + last;
			}
		}
		return translated.slice(0, Math.max(0, translated.length - diff));
	}
	if (best >= 0) {
		return translated.slice(0, best) + " ".repeat(bestLen - diff) + translated.slice(best + bestLen);
	}
	const last = translated.slice(-1);
	if (BORDER_CHARS.includes(last)) {
		return translated.slice(0, -1) + " ".repeat(-diff) + last;
	}
	return translated;
}

// TUI пишет кадр кодами позиционирования курсора \x1b[row;1H (не \n).
// Перевод (на уровне Theme) может удлинить строки боксов и сдвинуть правую
// границу. Чтобы рамка оставалась ровной, выравниваем каждую строку бокса по
// ЦЕЛЕВОЙ ширине — её задаёт строка рамки ╭...╮ (не меняется при переводе).
// Работает и для английского, и для русского текста, независимо от того,
// где именно произошёл перевод.
function fitFrameToTarget(frame: string): string {
	if (!frame || typeof frame !== "string") return frame;
	if (!frame.includes("│")) return frame;
	// Разбиваем на визуальные строки: по H-кодам, иначе по \n
	const hRe = /\x1b\[\d+;\d+H/;
	let segments: string[];
	let rejoinsWithH: boolean;
	if (hRe.test(frame)) {
		segments = frame.split(/(\x1b\[\d+;\d+H)/);
		rejoinsWithH = true;
	} else {
		segments = frame.split("\n");
		rejoinsWithH = false;
	}
	// Ищем целевую ширину по строке рамки (содержит ╭ или ╰)
	let target = -1;
	for (const seg of segments) {
		if (seg.includes("╭") || seg.includes("╰")) {
			const w = visWidth(seg);
			if (w > target) target = w;
			break;
		}
	}
	if (target <= 0) return frame;
	// Подгоняем строки бокса: только те, что между верхней (╭) и нижней (╰)
	// рамкой — это строки welcome-бокса. Другие │-элементы кадра не трогаем.
	const boxIdx: number[] = [];
	for (let i = 0; i < segments.length; i++) {
		if (rejoinsWithH && i % 2 === 1) continue; // H-код (делитель)
		const seg = segments[i];
		if (seg.includes("╭")) { continue; }
		if (seg.includes("╰")) { continue; }
		if (!seg.includes("│")) continue;
		// Строка бокса: только между ╭ и ╰ (welcome-бокс). Другие │-элементы
		// кадра не трогаем.
		const before = segments.slice(0, i).some((s) => s.includes("╭"));
		if (!before) continue;
		boxIdx.push(i);
	}
	if (boxIdx.length > 0) {
		const canonSep = canonicalSepCol(boxIdx.map((i) => segments[i]));
		for (const i of boxIdx) {
			// Сначала ставим разделитель в каноническую колонку (иначе
			// normalizeBoxLine только подгонит общую ширину, а │ останется
			// смещённым), затем выравниваем общую ширину.
			segments[i] = normalizeBoxLine(alignSepToCol(segments[i], canonSep), target);
		}
	}
	return rejoinsWithH ? segments.join("") : segments.join("\n");
}

// Приводит строку бокса к целевой ширине: убирает (или добавляет) пробелы из
// наибольшего interior-пропуска, не трогая текст и символы границ.
function normalizeBoxLine(line: string, target: number): string {
	const vw = visWidth(line);
	if (vw === target) return line;
	const diff = vw - target;
	if (diff > 0) {
		const re = / +/g;
		let m: RegExpExecArray | null;
		let best = -1;
		let bestLen = 0;
		while ((m = re.exec(line)) !== null) {
			if (m[0].length > bestLen) { bestLen = m[0].length; best = m.index; }
		}
		if (best >= 0 && bestLen >= diff) {
			return line.slice(0, best) + " ".repeat(bestLen - diff) + line.slice(best + bestLen);
		}
		// Нет достаточно большого пропуска — режем хвост (после последней границы)
		const lastBorder = lastBorderIndex(line);
		if (lastBorder >= 0) {
			return line.slice(0, lastBorder + 1);
		}
		return line.slice(0, Math.max(0, line.length - diff));
	}
	// Строка уже короче целевой — дополняем пропуском перед последней границей
	const lastBorder = lastBorderIndex(line);
	if (lastBorder >= 0) {
		return line.slice(0, lastBorder) + " ".repeat(-diff) + line.slice(lastBorder);
	}
	return line;
}

// Индекс (в кодопунктах) последнего символа рамки в строке; -1 если нет.
function lastBorderIndex(line: string): number {
	let idx = -1;
	let pos = 0;
	for (const ch of line) {
		if (BORDER_CHARS.includes(ch)) idx = pos;
		pos += 1;
	}
	return idx;
}

// Визуальная колонка первого ВНУТРЕННЕГО разделителя (│ или ┴) в строке;
// -1 если нет. Левая граница бокса (колонка 0) не считается.
function firstSepCol(line: string): number {
	let col = 0;
	let i = 0;
	while (i < line.length) {
		if (line[i] === "\x1b" && line[i + 1] === "[") {
			let j = i + 2;
			while (j < line.length && !/[a-zA-Z]/.test(line[j])) j++;
			i = j < line.length ? j + 1 : line.length;
			continue;
		}
		const ch = line[i];
		if ((ch === "│" || ch === "┴") && col > 0) return col;
		col += 1;
		i += 1;
	}
	return -1;
}

// Каноническая колонка внутреннего разделителя по набору строк бокса
// (наиболее частая). -1 если ни в одной строке разделителя нет.
function canonicalSepCol(lines: string[]): number {
	const counts = new Map<number, number>();
	for (const l of lines) {
		const c = firstSepCol(l);
		if (c > 0) counts.set(c, (counts.get(c) ?? 0) + 1);
	}
	let best = -1;
	let bestN = 0;
	for (const [c, n] of counts) {
		if (n > bestN) { bestN = n; best = c; }
	}
	return best;
}

// Ставит внутренний разделитель строки в каноническую колонку: убирает
// (sep > canon) или добавляет (sep < canon) пробелы в левом сегменте,
// не трогая текст и символы границ.
function alignSepToCol(line: string, canonSep: number): string {
	const sep = firstSepCol(line);
	if (canonSep < 0 || sep < 0 || sep === canonSep) return line;
	// Сырой индекс разделителя в строке
	let sepIdx = -1;
	let col = 0;
	let i = 0;
	while (i < line.length) {
		if (line[i] === "\x1b" && line[i + 1] === "[") {
			let j = i + 2;
			while (j < line.length && !/[a-zA-Z]/.test(line[j])) j++;
			i = j < line.length ? j + 1 : line.length;
			continue;
		}
		const ch = line[i];
		if ((ch === "│" || ch === "┴") && col > 0) { sepIdx = i; break; }
		col += 1;
		i += 1;
	}
	if (sepIdx < 0) return line;
	if (sep > canonSep) {
		const need = sep - canonSep;
		const left = line.slice(0, sepIdx);
		const re = / +/g;
		let m: RegExpExecArray | null;
		let best = -1;
		let bestLen = 0;
		while ((m = re.exec(left)) !== null) {
			if (m[0].length > bestLen) { bestLen = m[0].length; best = m.index; }
		}
		if (best >= 0 && bestLen >= need) {
			return line.slice(0, best) + " ".repeat(bestLen - need) + line.slice(best + bestLen);
		}
		return line; // места для подрезки нет — оставляем
	}
	return line.slice(0, sepIdx) + " ".repeat(canonSep - sep) + line.slice(sepIdx);
}

// ---------------------------------------------------------------------------
// Патчи
// ---------------------------------------------------------------------------
export default async function (pi: ExtensionAPI) {
	// Классы ядра: в API `pi` их нет (только registerTool/registerCommand и др.),
	// поэтому берём напрямую из пакетов. jiti резолвит те же модули, что и
	// работающее приложение (alias в loader.js), поэтому патч прототипов
	// действует на живые экземпляры.
	let ThemeCtor: any = (pi as any).Theme;
	if (!ThemeCtor) {
		try {
			ThemeCtor = (await import("@earendil-works/pi-coding-agent")).Theme;
		} catch {
			ThemeCtor = undefined;
		}
	}
	let KBM: any = (pi as any).KeybindingsManager;
	let SelectListCtor: any = undefined;
	let SettingsListCtor: any = undefined;
	try {
		const tui = await import("@earendil-works/pi-tui");
		if (!KBM) KBM = tui.KeybindingsManager;
		SelectListCtor = tui.SelectList;
		SettingsListCtor = tui.SettingsList;
	} catch {
		// pi-tui недоступен — патчи списков пропускаем, остальное работает
	}

	// 1. Theme.prototype — все строки через тему (включая описание настроек)
	if (ThemeCtor?.prototype) {
		const methods: Array<[string, number]> = [
			["fg", 1],
			["bg", 1],
			["bold", 0],
			["italic", 0],
			["underline", 0],
			["inverse", 0],
			["strikethrough", 0],
			["style", 0],
		];
		for (const [name, textIdx] of methods) {
			const original = ThemeCtor.prototype[name];
			if (typeof original !== "function") continue;
			ThemeCtor.prototype[name] = function patched(this: any, ...args: any[]) {
				if (typeof args[textIdx] === "string") args[textIdx] = ru(args[textIdx]);
				return original.apply(this, args);
			};
		}
	}

	// 2. SelectList.prototype.render — описания пунктов (автодополнение /:
	// скиллы из bigpowers и других расширений) переводятся ДО усечения.
	if (SelectListCtor?.prototype) {
		const origRender = SelectListCtor.prototype.render;
		SelectListCtor.prototype.render = function patchedRender(this: any, ...args: any[]) {
			try {
				for (const item of this.items ?? []) {
					if (item && typeof item.description === "string") {
						const t = ruDesc(item.description);
						if (t !== item.description) item.description = t;
					}
				}
			} catch {
				// не критично
			}
			return origRender.apply(this, args);
		};
	}

	// 3. SettingsList.prototype.renderMainList — описание выбранной настройки
	// переводится ДО wrapTextWithAnsi (иначе обрывки строк не попадут в словарь).
	if (SettingsListCtor?.prototype?.renderMainList) {
		const origRML = SettingsListCtor.prototype.renderMainList;
		SettingsListCtor.prototype.renderMainList = function patchedRML(this: any, ...args: any[]) {
			try {
				const items = this.getDisplayItems?.() ?? this.items;
				const sel = items?.[this.selectedIndex];
				if (sel && typeof sel.description === "string") {
					const t = ruDesc(sel.description);
					if (t !== sel.description) sel.description = t;
				}
			} catch {
				// не критично
			}
			return origRML.apply(this, args);
		};
	}
	// 3a. Text.prototype.render (pi-tui) — финальная страховка для строк боксов.
	// ТUI-диф сравнивает строки ДО stdout-патча, поэтому выравнивание правого
	// края рамки делаем на уровне render: если в кадре есть строка рамки
	// (╭/╰) и она задаёт целевую ширину, все строки бокса в том же кадре
	// приводятся к этой ширине (ANSI-aware). Покрывает welcome-бокс и любые
	// другие боксы, чьи строки переводятся патчами выше.
	try {
		const tuiMod = await import("@earendil-works/pi-tui");
		const TextCtor: any = tuiMod.Text;
		if (TextCtor?.prototype && !TextCtor.prototype.render.__ruFramePatched) {
			const origTextRender = TextCtor.prototype.render;
			TextCtor.prototype.render = function patchedTextRender(this: any, ...args: any[]) {
				const origLines = origTextRender.apply(this, args);
				// 1.6.0: render() возвращает readonly string[] (кэш компонента) —
				// мутировать на месте нельзя, копируем.
				const lines: unknown[] = Array.isArray(origLines) ? [...origLines] : [];
				try {
					if (lines.length >= 3) {
						const target = lines.reduce((best: number, l: unknown) => {
							if (typeof l === "string" && (l.includes("╭") || l.includes("╰"))) {
								const w = visWidth(l);
								if (w > best) best = w;
							}
							return best;
						}, 0);
						if (target > 0) {
							const canonSep = canonicalSepCol(lines.filter((l): l is string => typeof l === "string"));
							for (let i = 0; i < lines.length; i++) {
								if (typeof lines[i] === "string" && lines[i].includes("│")) {
									lines[i] = normalizeBoxLine(alignSepToCol(lines[i], canonSep), target);
								}
							}
						}
					}
				} catch {
					// не критично
				}
				return lines;
			};
			TextCtor.prototype.render.__ruFramePatched = true;
		}
	} catch {
		// pi-tui недоступен — выравнивание боксов пропускаем
	}
	// 3b. Welcome-бокс (pi-powerline-footer): переводим и выравниваем строки
	// на уровне render(). ТUI-диф сравнивает строки ДО stdout-патча: перевод
	// только на stdout давал «призрачные» хвосты — первый кадр (English, без
	// очистки) и дельта-рендер без \x1b[2K для неизменённых строк оставляли
	// старые широкие хвосты правее рамки. На уровне render() строки бокса
	// стабильны (кэш ru) и всегда равны ширине верхней рамки (ANSI-aware).
	try {
		const plf = await import("pi-powerline-footer/welcome.ts");
		const fitBoxLineToWidth = (line: string, target: number): string => {
			const w = visWidth(line);
			if (w === 0 || w === target) return line;
			// Фрагменты: ANSI-коды (невидимые) и по одному видимому символу.
			const pieces: Array<{ start: number; end: number; vis: number }> = [];
			let i = 0;
			while (i < line.length) {
				if (line[i] === "\x1b" && line[i + 1] === "[") {
					let j = i + 2;
					while (j < line.length && !/[a-zA-Z]/.test(line[j])) j++;
					const end = j < line.length ? j + 1 : line.length;
					pieces.push({ start: i, end, vis: 0 });
					i = end;
				} else {
					pieces.push({ start: i, end: i + 1, vis: 1 });
					i += 1;
				}
			}
			let lastVis = -1;
			for (let p = pieces.length - 1; p >= 0; p--) {
				if (pieces[p].vis > 0) { lastVis = p; break; }
			}
			if (lastVis <= 0) return line;
			if (w > target) {
				// Убираем (w - target) видимых символов из контента,
				// замыкающий символ рамки на конце строки сохраняем.
				const excess = w - target;
				let cutIdx = pieces[lastVis].start;
				let removed = 0;
				for (let p = lastVis - 1; p >= 0 && removed < excess; p--) {
					if (pieces[p].vis > 0) removed += pieces[p].vis;
					cutIdx = pieces[p].start;
				}
				if (removed < excess) cutIdx = 0;
				return line.slice(0, cutIdx) + line.slice(pieces[lastVis].start);
			}
			// Строка короче рамки — добираем пробелами перед замыкающим символом.
			return line.slice(0, pieces[lastVis].start) + " ".repeat(target - w) + line.slice(pieces[lastVis].start);
		};
		const wrapWelcomeRender = (ctor: any) => {
			if (!ctor?.prototype?.render || ctor.prototype.render.__ruPatched) return;
			const origRender = ctor.prototype.render;
			ctor.prototype.render = function patchedWelcomeRender(this: any, ...args: any[]) {
				const origLines = origRender.apply(this, args);
				// 1.6.0: render() возвращает readonly string[] (кэш компонента) —
				// мутировать на месте нельзя, копируем.
				const lines: unknown[] = Array.isArray(origLines) ? [...origLines] : [];
				try {
					if (lines.length >= 3 && typeof lines[0] === "string") {
						const target = visWidth(ru(lines[0] as string));
						// Сначала переводим все строки, затем по ним ищем
						// каноническую колонку внутреннего разделителя (│/┴)
						// и ставим его на место в каждой строке — перевод
						// может удлинить левую колонку и сдвинуть │.
						const ruLines = lines.map((l) => (typeof l === "string" ? ru(l) : l));
						const canonSep = canonicalSepCol(ruLines.filter((l): l is string => typeof l === "string"));
						for (let i = 0; i < ruLines.length; i++) {
							if (typeof ruLines[i] === "string") {
								lines[i] = fitBoxLineToWidth(alignSepToCol(ruLines[i], canonSep), target);
							}
						}
					}
				} catch {
					// не критично
				}
				return lines;
			};
			ctor.prototype.render.__ruPatched = true;
		};
		wrapWelcomeRender(plf.WelcomeComponent);
		wrapWelcomeRender(plf.WelcomeHeader);
	} catch {
		// пакет недоступен — welcome-бокс не патчим
	}

	// 4. registerTool — описания инструментов
	const originalRegisterTool = pi.registerTool.bind(pi);
	pi.registerTool = (tool: any, ...rest: any[]) => {
		if (tool && typeof tool === "object") {
			if (typeof tool.label === "string") tool.label = ru(tool.label);
			if (typeof tool.description === "string") tool.description = ru(tool.description);
			if (tool.parameters && typeof tool.parameters.description === "string") {
				tool.parameters.description = ru(tool.parameters.description);
			}
			if (tool.parameters?.properties) {
				for (const key of Object.keys(tool.parameters.properties)) {
					const prop = tool.parameters.properties[key];
					if (prop && typeof prop.description === "string") {
						prop.description = ru(prop.description);
					}
				}
			}
		}
		return originalRegisterTool(tool, ...rest);
	};

	// 5. registerCommand — описания slash-команд
	const originalRegisterCommand = pi.registerCommand.bind(pi);
	pi.registerCommand = (name: string, options: any, ...rest: any[]) => {
		if (options && typeof options.description === "string") {
			options.description = ru(options.description);
		}
		return originalRegisterCommand(name, options, ...rest);
	};
	// 5a. registerShortcut — описания хоткеев расширений (секция «Расширения» в /hotkeys)
	const originalRegisterShortcut = pi.registerShortcut.bind(pi);
	pi.registerShortcut = (shortcut: any, options: any, ...rest: any[]) => {
		if (options && typeof options.description === "string") {
			options.description = ru(options.description);
		}
		return originalRegisterShortcut(shortcut, options, ...rest);
	};

	// 5b. BUILTIN_SLASH_COMMANDS — встроенные команды не проходят через registerCommand
	try {
		const mod = await import("@earendil-works/pi-coding-agent/dist/core/slash-commands.js");
		for (const cmd of (mod.BUILTIN_SLASH_COMMANDS as any[])) {
			if (cmd && typeof cmd.description === "string") cmd.description = ru(cmd.description);
			if (cmd && typeof cmd.argumentHint === "string") cmd.argumentHint = ru(cmd.argumentHint);
		}
	} catch {
		// не критично
	}

	// 6. KeybindingsManager.prototype.create — описания хоткеев
	if (KBM?.prototype?.create) {
		const originalCreate = KBM.prototype.create;
		KBM.prototype.create = function patchedCreate(this: any, ...args: any[]) {
			const instance = originalCreate.apply(this, args);
			try {
				const definitions = instance.getDefinitions?.();
				if (definitions) {
					for (const key of Object.keys(definitions)) {
						const def = definitions[key];
						if (def && typeof def.description === "string") {
							def.description = ru(def.description);
						}
					}
				}
			} catch {
				// не критично
			}
			return instance;
		};
	}

	// 7. process.stdout.write — финальная страховка для hint-строк и welcome-бокса
	const originalWrite = process.stdout.write;
	(process.stdout as any).write = function patchedWrite(this: any, chunk: any, ...args: any[]) {
		const translateChunk = (c: any): any => {
			if (typeof c === "string") {
				const t = ru(c);
				// Перевод может происходить на уровне Theme (до stdout), поэтому
				// выравнивание ширины делаем ВСЕГДА по целевой ширине рамки
				// (строка ╭...╮ не меняется при переводе и задаёт эталон).
				return fitFrameToTarget(t);
			}
			if (Buffer.isBuffer(c)) {
				try {
					return Buffer.from(ru(c.toString("utf8")), "utf8");
				} catch {
					return c;
				}
			}
			return c;
		};
		if (Array.isArray(chunk)) {
			for (let i = 0; i < chunk.length; i++) chunk[i] = translateChunk(chunk[i]);
		} else {
			chunk = translateChunk(chunk);
		}
		return originalWrite.call(this, chunk, ...args);
	};

	// Индикатор активности: ui-контекст доступен в ctx событий.
	pi.on("session_start", (ctx: any) => {
		try {
			ctx?.ui?.setStatus?.("ru", `[RU] i18n-ru: ${Object.keys(RUS).length} строк`);
		} catch {
			// print/RPC-режим — статуса нет
		}
	});
}
