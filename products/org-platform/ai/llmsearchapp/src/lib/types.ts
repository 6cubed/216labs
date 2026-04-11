export type Source = {
  title: string;
  url: string;
  snippet: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  related?: string[];
  createdAt: string;
};

export type Session = {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: string;
};
