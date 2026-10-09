/**
 * Незакрытые задачи Google Tasks со сроком не дальше deadlinesAheadDays дней,
 * включая просроченные. Задачи без даты в сводку не попадают.
 */
function fetchDeadlines_(todayKey) {
  const lastKey = addDays_(todayKey, CONFIG.tasks.deadlinesAheadDays);
  const deadlines = [];

  listTaskLists_().forEach(function (list) {
    listOpenTasks_(list.id).forEach(function (task) {
      if (!task.due || !task.title) return;
      // Tasks API хранит только дату: время в due всегда 00:00Z.
      const date = task.due.slice(0, 10);
      if (date > lastKey) return;
      deadlines.push({ date: date, title: task.title });
    });
  });

  return deadlines.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
}

function listTaskLists_() {
  const lists = [];
  let pageToken;
  do {
    const opts = { maxResults: 100 };
    if (pageToken) opts.pageToken = pageToken;
    const page = Tasks.Tasklists.list(opts);
    lists.push.apply(lists, page.items || []);
    pageToken = page.nextPageToken;
  } while (pageToken);
  return lists;
}

function listOpenTasks_(listId) {
  const tasks = [];
  let pageToken;
  do {
    const opts = { showCompleted: false, showHidden: false, maxResults: 100 };
    if (pageToken) opts.pageToken = pageToken;
    const page = Tasks.Tasks.list(listId, opts);
    (page.items || []).forEach(function (task) {
      if (task.status !== 'completed') tasks.push(task);
    });
    pageToken = page.nextPageToken;
  } while (pageToken);
  return tasks;
}
