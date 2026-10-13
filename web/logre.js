// Подсветка синтаксиса лога LLM: один проход, победитель — первый попавшийся паттерн.
// Служебный файл (не идёт через шаблон PAGE в gpu-monitor.js), чтобы не путать
// экранирование бэкслэшей. Подключается в <head> до основного скрипта страницы.
//
// Группы (по порядку): url, windows-путь, timestamp llama.cpp (SS.mmm.uuu),
// число с опциональной единицей, ключ "name ="/"name:", ERROR/FATAL/PANIC,
// WARN, OK/SUCCESS, INFO/DEBUG, true/false/null/none, строка в кавычках.
window.LOG_RE =
  /(https?:\/\/[^\s"'<>]+)|([A-Za-z]:\\[^\s,;:'"]*)|(\b\d{1,3}(?:\.\d{1,3}){3})|(\b\d[\d_]*(?:\.\d+)?(?:\s?(?:GB\/s|MB\/s|KB\/s|t\/s|tokens\/s|ms\/token|GB|MB|KB|TB|MHz|GHz|MW|W|ms|tokens))?)|(\b[A-Za-z_][A-Za-z0-9_]*\s*[=:])|(\b(?:ERROR|FATAL|PANIC)\b)|(\bWARN(?:ING)?\b)|(\bOK\b|\bSUCCESS(?:FUL)?\b)|(\b(?:INFO|DEBUG)\b)|(\b(?:true|false|null|none)\b)|("[^"\n]*"|'[^'\n]*')/g;
