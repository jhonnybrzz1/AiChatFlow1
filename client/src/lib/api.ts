import { apiRequest } from "./queryClient";
import { type Demand, type InsertDemand, type ChatMessage } from "@shared/schema";

export const api = {
  demands: {
    getAll: async (): Promise<Demand[]> => {
      const response = await apiRequest("GET", "/api/demands");
      return response.json();
    },

    get: async (id: number): Promise<Demand> => {
      const response = await apiRequest("GET", `/api/demands/${id}`);
      return response.json();
    },

    create: async (demand: InsertDemand, files?: FileList, githubRepoOwner?: string, githubRepoName?: string): Promise<Demand> => {
      const formData = new FormData();

      // Add demand data
      Object.entries(demand).forEach(([key, value]) => {
        formData.append(key, value as string);
      });

      // Add GitHub repository information if provided
      if (githubRepoOwner && githubRepoName) {
        formData.append('githubRepoOwner', githubRepoOwner);
        formData.append('githubRepoName', githubRepoName);
      }

      // Add files if any
      if (files) {
        Array.from(files).forEach((file) => {
          formData.append('files', file);
        });
      }

      const response = await fetch("/api/demands", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }

      return response.json();
    },
    createWithFormData: async (formData: FormData): Promise<Demand> => {
      const response = await fetch("/api/demands", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }

      return response.json();
    },

    getMessages: async (id: number): Promise<ChatMessage[]> => {
      const response = await apiRequest("GET", `/api/demands/${id}/messages`);
      return response.json();
    },

    subscribeToUpdates: (id: number, onUpdate: (demand: Demand) => void) => {
      const eventSource = new EventSource(`/api/demands/${id}/events`);

      eventSource.onmessage = (event) => {
        const demand = JSON.parse(event.data);
        onUpdate(demand);
      };

      eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        eventSource.close();
      };

      return () => eventSource.close();
    }
  },

  documents: {
    download: (filename: string) => {
      window.open(`/api/documents/${filename}`, '_blank');
    }
  },

  github: {
    listRepos: async (): Promise<any[]> => {
      const response = await apiRequest("GET", "/api/github/repos");
      return response.json();
    },
    searchFiles: async (owner: string, repo: string, query: string): Promise<string[]> => {
      const response = await apiRequest("POST", "/api/github/search-files", { owner, repo, query });
      return response.json();
    },
    getRepoContent: async (owner: string, repo: string, path: string = ''): Promise<any> => {
      const response = await apiRequest("GET", `/api/github/repos/${owner}/${repo}/content?path=${encodeURIComponent(path)}`);
      return response.json();
    }
  }
};
