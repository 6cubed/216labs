import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";

const STORE_PATH = process.env.GROUNDTRUTH_STORE_PATH || "/app/data/groundtruth.json";

const SEED_IMAGE_URLS = [
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1474511320723-9a56873867b5?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=800&q=80",
];

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseLines(value) {
  return String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function defaultStore() {
  const now = new Date().toISOString();
  const datasetId = uid("dataset");
  const taskId = uid("task");
  return {
    datasets: [
      {
        id: datasetId,
        name: "Street inventory seed set",
        description: "Seed image set for object-presence labeling demo.",
        instructions:
          "Label each image with all objects you can clearly see from the required set.",
        requiredLabels: ["person", "car", "animal", "tree", "building"],
        imageUrls: SEED_IMAGE_URLS,
        createdAt: now,
      },
    ],
    tasks: [
      {
        id: taskId,
        datasetId,
        title: "Seed pass: visible objects",
        status: "open",
        createdAt: now,
      },
    ],
    submissions: [],
  };
}

function loadStore() {
  if (!existsSync(STORE_PATH)) {
    const seed = defaultStore();
    saveStore(seed);
    return seed;
  }
  try {
    const raw = readFileSync(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.datasets)) return defaultStore();
    if (!Array.isArray(parsed.tasks)) parsed.tasks = [];
    if (!Array.isArray(parsed.submissions)) parsed.submissions = [];
    return parsed;
  } catch {
    return defaultStore();
  }
}

function saveStore(data) {
  mkdirSync(dirname(STORE_PATH), { recursive: true });
  writeFileSync(STORE_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export function listDatasets() {
  const store = loadStore();
  return [...store.datasets].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function listOpenTasks() {
  const store = loadStore();
  return store.tasks
    .filter((task) => task.status === "open")
    .map((task) => ({
      ...task,
      dataset: store.datasets.find((dataset) => dataset.id === task.datasetId) || null,
      submissions: store.submissions.filter((s) => s.taskId === task.id),
    }))
    .filter((task) => task.dataset)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function createDatasetWithTask(input) {
  const name = String(input.name || "").trim();
  const description = String(input.description || "").trim();
  const taskTitle = String(input.taskTitle || "").trim();
  const instructions = String(input.instructions || "").trim();
  const requiredLabels = parseCsv(input.requiredLabels);
  const imageUrls = parseLines(input.imageUrls);

  if (!name) return { ok: false, error: "Dataset name is required." };
  if (!taskTitle) return { ok: false, error: "Task title is required." };
  if (requiredLabels.length === 0) {
    return { ok: false, error: "Provide at least one required label." };
  }
  if (imageUrls.length === 0) {
    return { ok: false, error: "Provide at least one image URL." };
  }

  const invalidUrl = imageUrls.find((url) => !/^https?:\/\//i.test(url));
  if (invalidUrl) {
    return { ok: false, error: `Image URL must start with http:// or https:// (${invalidUrl}).` };
  }

  const store = loadStore();
  const now = new Date().toISOString();
  const dataset = {
    id: uid("dataset"),
    name,
    description,
    instructions:
      instructions || "Label every image according to the required labels for this task.",
    requiredLabels,
    imageUrls,
    createdAt: now,
  };
  const task = {
    id: uid("task"),
    datasetId: dataset.id,
    title: taskTitle,
    status: "open",
    createdAt: now,
  };

  store.datasets.push(dataset);
  store.tasks.push(task);
  saveStore(store);
  return { ok: true, dataset, task };
}

export function submitLabels(input) {
  const taskId = String(input.taskId || "").trim();
  const workerName = String(input.workerName || "").trim();
  const labelsByImage = input.labelsByImage || {};

  if (!taskId) return { ok: false, error: "Task is required." };
  if (!workerName) return { ok: false, error: "Labeller name is required." };

  const store = loadStore();
  const task = store.tasks.find((t) => t.id === taskId && t.status === "open");
  if (!task) return { ok: false, error: "Task not found or no longer open." };
  const dataset = store.datasets.find((d) => d.id === task.datasetId);
  if (!dataset) return { ok: false, error: "Dataset not found for this task." };

  const normalized = dataset.imageUrls.map((url) => ({
    imageUrl: url,
    labels: parseCsv(labelsByImage[url] || ""),
  }));
  const labelledCount = normalized.filter((row) => row.labels.length > 0).length;

  if (labelledCount === 0) {
    return { ok: false, error: "Add labels for at least one image before submitting." };
  }

  const submission = {
    id: uid("submission"),
    taskId: task.id,
    datasetId: dataset.id,
    workerName,
    labelsByImage: normalized,
    createdAt: new Date().toISOString(),
  };

  store.submissions.push(submission);
  saveStore(store);
  return { ok: true, submission };
}

export function getStorePathForDebug() {
  return STORE_PATH;
}
