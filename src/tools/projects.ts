import { z } from "zod";
import { SevdeskClient } from "../client.js";

export const projectTools = {
  list_projects: {
    description: "List all projects, optionally filtered by contact",
    inputSchema: z.object({
      contactId: z.number().optional().describe("Filter by contact ID"),
      limit: z.number().optional().describe("Maximum number of results (default: 100)"),
    }),
    handler: async (client: SevdeskClient, params: { contactId?: number; limit?: number }) => {
      const queryParams: Record<string, string> = {
        limit: String(params.limit || 100),
      };
      if (params.contactId) {
        queryParams["contact[id]"] = String(params.contactId);
        queryParams["contact[objectName]"] = "Contact";
      }

      const queryString = new URLSearchParams(queryParams).toString();
      const { data, error } = await client.GET(`/Project?${queryString}` as any, {});
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  get_project: {
    description: "Get a specific project by ID",
    inputSchema: z.object({
      projectId: z.number().describe("The ID of the project"),
    }),
    handler: async (client: SevdeskClient, params: { projectId: number }) => {
      const { data, error } = await client.GET(`/Project/${params.projectId}` as any, {});
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  create_project: {
    description: "Create a new project for time tracking",
    inputSchema: z.object({
      name: z.string().describe("Project name (e.g., 'T&M' or PO number like '4501693804_20')"),
      contactId: z.number().describe("The contact ID this project belongs to"),
    }),
    handler: async (client: SevdeskClient, params: { name: string; contactId: number }) => {
      const body = {
        name: params.name,
        contact: {
          id: params.contactId,
          objectName: "Contact",
        },
      };

      const { data, error } = await client.POST("/Project" as any, {
        body: body as any,
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  update_project: {
    description: "Update an existing project",
    inputSchema: z.object({
      projectId: z.number().describe("The ID of the project to update"),
      name: z.string().optional().describe("New project name"),
      contactId: z.number().optional().describe("New contact ID"),
    }),
    handler: async (client: SevdeskClient, params: { projectId: number; name?: string; contactId?: number }) => {
      const body: Record<string, any> = {};
      if (params.name) body.name = params.name;
      if (params.contactId) {
        body.contact = {
          id: params.contactId,
          objectName: "Contact",
        };
      }

      const { data, error } = await client.PUT(`/Project/${params.projectId}` as any, {
        body: body as any,
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  delete_project: {
    description: "Delete a project",
    inputSchema: z.object({
      projectId: z.number().describe("The ID of the project to delete"),
    }),
    handler: async (client: SevdeskClient, params: { projectId: number }) => {
      const { data, error } = await client.DELETE(`/Project/${params.projectId}` as any, {});
      if (error) throw new Error(JSON.stringify(error));
      return data || { success: true, message: `Project ${params.projectId} deleted` };
    },
  },

  find_or_create_project: {
    description: "Find an existing project for a contact by name, or create it if it doesn't exist. Useful for automated time tracking setup.",
    inputSchema: z.object({
      name: z.string().describe("Project name to find or create"),
      contactId: z.number().describe("The contact ID"),
    }),
    handler: async (client: SevdeskClient, params: { name: string; contactId: number }) => {
      // First, try to find existing project
      const queryParams = new URLSearchParams({
        "contact[id]": String(params.contactId),
        "contact[objectName]": "Contact",
      }).toString();

      const { data: listData, error: listError } = await client.GET(`/Project?${queryParams}` as any, {});
      if (listError) throw new Error(JSON.stringify(listError));

      const projects = (listData as any).objects || [];
      const existingProject = projects.find((p: any) => p.name === params.name);

      if (existingProject) {
        return {
          action: "found",
          project: existingProject,
        };
      }

      // Create new project
      const body = {
        name: params.name,
        contact: {
          id: params.contactId,
          objectName: "Contact",
        },
      };

      const { data: createData, error: createError } = await client.POST("/Project" as any, {
        body: body as any,
      });
      if (createError) throw new Error(JSON.stringify(createError));

      return {
        action: "created",
        project: (createData as any).objects,
      };
    },
  },
};
