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
    description: "Create a new project for time tracking. Creates via a dummy time tracking entry that gets deleted afterwards.",
    inputSchema: z.object({
      name: z.string().describe("Project name (e.g., 'T&M' or PO number like '4501693804_20')"),
      contactId: z.number().describe("The contact ID this project belongs to"),
      hourlyNet: z.number().optional().describe("Hourly rate net (default: 100)"),
    }),
    handler: async (client: SevdeskClient, params: { name: string; contactId: number; hourlyNet?: number }) => {
      const hourlyNet = params.hourlyNet || 100;
      const hourlyTax = hourlyNet * 0.19;
      const hourlyGross = hourlyNet + hourlyTax;
      const now = Math.floor(Date.now() / 1000);

      // Create project via dummy time tracking entry
      const formData = new URLSearchParams();
      formData.append('trackings[0][create]', 'null');
      formData.append('trackings[0][update]', 'null');
      formData.append('trackings[0][sevClient]', 'null');
      formData.append('trackings[0][contact][id]', String(params.contactId));
      formData.append('trackings[0][contact][objectName]', 'Contact');
      formData.append('trackings[0][project]', 'null');
      formData.append('trackings[0][part]', 'null');
      formData.append('trackings[0][employee][id]', '812164');
      formData.append('trackings[0][employee][objectName]', 'SevUser');
      formData.append('trackings[0][tracking]', 'null');
      formData.append('trackings[0][invoicePos]', 'null');
      formData.append('trackings[0][date]', String(now));
      formData.append('trackings[0][status]', 'null');
      formData.append('trackings[0][billable]', 'true');
      formData.append('trackings[0][precision]', 'PT1M');
      formData.append('trackings[0][quantity]', 'null');
      formData.append('trackings[0][taxRate]', '19');
      formData.append('trackings[0][hourlyGross]', String(hourlyGross));
      formData.append('trackings[0][hourlyTax]', String(hourlyTax));
      formData.append('trackings[0][hourlyNet]', String(hourlyNet));
      formData.append('trackings[0][sumGross]', 'null');
      formData.append('trackings[0][sumTax]', 'null');
      formData.append('trackings[0][sumNet]', 'null');
      formData.append('trackings[0][usedAt]', 'null');
      formData.append('trackings[0][description]', 'Projekt-Setup (wird gelöscht)');
      formData.append('trackings[0][objectName]', 'ContactTimeTracking');
      formData.append('trackings[0][mapAll]', 'true');
      formData.append('trackings[0][duration]', 'null');
      formData.append('durations', '[{"unit":"date_interval","value":"00:01"}]');
      formData.append('projects[0][create]', 'null');
      formData.append('projects[0][update]', 'null');
      formData.append('projects[0][sevClient]', 'null');
      formData.append('projects[0][contact]', 'null');
      formData.append('projects[0][name]', params.name);
      formData.append('projects[0][objectName]', 'Project');
      formData.append('projects[0][id]', 'null');
      formData.append('projects[0][mapAll]', 'true');
      formData.append('parts[0][objectName]', 'Part');
      formData.append('parts[0][mapAll]', 'true');

      // Use fetch directly since we need form-urlencoded
      const response = await fetch('https://my.sevdesk.de/api/v1/ContactTimeTracking/Factory/saveTrackedEvents', {
        method: 'POST',
        headers: {
          'Authorization': (client as any).token || process.env.SEVDESK_API_TOKEN || '',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: formData.toString(),
      });

      const result = await response.json();
      if (result.error) throw new Error(JSON.stringify(result.error));

      const tracking = result.objects?.[0];
      const project = tracking?.project;

      if (!tracking || !project) {
        throw new Error('Failed to create project: ' + JSON.stringify(result));
      }

      // Delete the dummy time tracking entry
      const deleteResponse = await fetch(`https://my.sevdesk.de/api/v1/ContactTimeTracking/${tracking.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': (client as any).token || process.env.SEVDESK_API_TOKEN || '',
          'Accept': 'application/json',
        },
      });

      return {
        project: project,
        message: `Project '${params.name}' created with ID ${project.id}. Dummy time entry was deleted.`,
      };
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
      hourlyNet: z.number().optional().describe("Hourly rate net for new projects (default: 100)"),
    }),
    handler: async (client: SevdeskClient, params: { name: string; contactId: number; hourlyNet?: number }) => {
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

      // Create new project via create_project handler
      const createResult = await projectTools.create_project.handler(client, {
        name: params.name,
        contactId: params.contactId,
        hourlyNet: params.hourlyNet,
      });

      return {
        action: "created",
        project: createResult.project,
      };
    },
  },
};
