import { z } from "zod";
import { SevdeskClient } from "../client.js";

export const timeTrackingTools = {
  list_time_entries: {
    description: "List time tracking entries for a contact. Returns unbilled entries by default.",
    inputSchema: z.object({
      contactId: z.number().describe("The contact ID"),
      used: z.boolean().optional().describe("Filter by used/billed status. Default: false (unbilled only)"),
      limit: z.number().optional().describe("Maximum number of results (default: 100)"),
    }),
    handler: async (client: SevdeskClient, params: { contactId: number; used?: boolean; limit?: number }) => {
      const queryParams = new URLSearchParams({
        "contact[id]": String(params.contactId),
        "contact[objectName]": "Contact",
        "used": String(params.used ?? false),
        "embed": "duration,startDate,endDate,contact,project",
        "limit": String(params.limit || 100),
        "orderBy[0][field]": "date",
        "orderBy[0][arrangement]": "desc",
      }).toString();

      const { data, error } = await client.GET(`/ContactTimeTracking?${queryParams}` as any, {});
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  get_time_entry: {
    description: "Get a specific time tracking entry by ID",
    inputSchema: z.object({
      timeEntryId: z.number().describe("The ID of the time tracking entry"),
    }),
    handler: async (client: SevdeskClient, params: { timeEntryId: number }) => {
      const { data, error } = await client.GET(`/ContactTimeTracking/${params.timeEntryId}?embed=duration,project,contact` as any, {});
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  create_time_entry: {
    description: "Create a new time tracking entry for a contact",
    inputSchema: z.object({
      contactId: z.number().describe("The contact ID"),
      projectId: z.number().describe("The project ID"),
      description: z.string().describe("Description of the work done"),
      durationMinutes: z.number().describe("Duration in minutes"),
      date: z.string().optional().describe("Date (YYYY-MM-DD). Default: today"),
      hourlyNet: z.number().describe("Hourly rate net"),
      taxRate: z.number().optional().describe("Tax rate in percent (default: 19)"),
    }),
    handler: async (client: SevdeskClient, params: {
      contactId: number;
      projectId: number;
      description: string;
      durationMinutes: number;
      date?: string;
      hourlyNet: number;
      taxRate?: number;
    }) => {
      const taxRate = params.taxRate ?? 19;
      const hourlyTax = params.hourlyNet * taxRate / 100;
      const hourlyGross = params.hourlyNet + hourlyTax;
      
      // Parse date or use today
      let timestamp: number;
      if (params.date) {
        timestamp = Math.floor(new Date(params.date).getTime() / 1000);
      } else {
        timestamp = Math.floor(Date.now() / 1000);
      }

      // Format duration as HH:MM
      const hours = Math.floor(params.durationMinutes / 60);
      const minutes = params.durationMinutes % 60;
      const durationStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

      const formData = new URLSearchParams();
      formData.append('trackings[0][create]', 'null');
      formData.append('trackings[0][update]', 'null');
      formData.append('trackings[0][sevClient]', 'null');
      formData.append('trackings[0][contact][id]', String(params.contactId));
      formData.append('trackings[0][contact][objectName]', 'Contact');
      formData.append('trackings[0][project][id]', String(params.projectId));
      formData.append('trackings[0][project][objectName]', 'Project');
      formData.append('trackings[0][part]', 'null');
      formData.append('trackings[0][employee][id]', '812164');
      formData.append('trackings[0][employee][objectName]', 'SevUser');
      formData.append('trackings[0][tracking]', 'null');
      formData.append('trackings[0][invoicePos]', 'null');
      formData.append('trackings[0][date]', String(timestamp));
      formData.append('trackings[0][status]', 'null');
      formData.append('trackings[0][billable]', 'true');
      formData.append('trackings[0][precision]', 'PT1M');
      formData.append('trackings[0][quantity]', 'null');
      formData.append('trackings[0][taxRate]', String(taxRate));
      formData.append('trackings[0][hourlyGross]', String(hourlyGross));
      formData.append('trackings[0][hourlyTax]', String(hourlyTax));
      formData.append('trackings[0][hourlyNet]', String(params.hourlyNet));
      formData.append('trackings[0][sumGross]', 'null');
      formData.append('trackings[0][sumTax]', 'null');
      formData.append('trackings[0][sumNet]', 'null');
      formData.append('trackings[0][usedAt]', 'null');
      formData.append('trackings[0][description]', params.description);
      formData.append('trackings[0][objectName]', 'ContactTimeTracking');
      formData.append('trackings[0][mapAll]', 'true');
      formData.append('trackings[0][duration]', 'null');
      formData.append('durations', `[{"unit":"date_interval","value":"${durationStr}"}]`);
      formData.append('parts[0][objectName]', 'Part');
      formData.append('parts[0][mapAll]', 'true');

      const response = await fetch('https://my.sevdesk.de/api/v1/ContactTimeTracking/Factory/saveTrackedEvents', {
        method: 'POST',
        headers: {
          'Authorization': (client as any).token,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: formData.toString(),
      });

      const result = await response.json();
      if (result.error) throw new Error(JSON.stringify(result.error));
      return result;
    },
  },

  delete_time_entry: {
    description: "Delete a time tracking entry",
    inputSchema: z.object({
      timeEntryId: z.number().describe("The ID of the time tracking entry to delete"),
    }),
    handler: async (client: SevdeskClient, params: { timeEntryId: number }) => {
      const response = await fetch(`https://my.sevdesk.de/api/v1/ContactTimeTracking/${params.timeEntryId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': (client as any).token,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(JSON.stringify(error));
      }

      return { success: true, message: `Time entry ${params.timeEntryId} deleted` };
    },
  },

  create_invoice_from_time_entries: {
    description: "Create a draft invoice from unbilled time tracking entries",
    inputSchema: z.object({
      timeEntryIds: z.array(z.number()).describe("Array of time tracking entry IDs to include in the invoice"),
    }),
    handler: async (client: SevdeskClient, params: { timeEntryIds: number[] }) => {
      if (params.timeEntryIds.length === 0) {
        throw new Error("At least one time entry ID is required");
      }

      const formData = new URLSearchParams();
      params.timeEntryIds.forEach((id, idx) => {
        formData.append(`tracking[${idx}][id]`, String(id));
        formData.append(`tracking[${idx}][objectName]`, 'ContactTimeTracking');
      });

      const response = await fetch(
        'https://my.sevdesk.de/api/v1/Invoice/Factory/createInvoiceFromContactTimeTracking?embed=contact,total',
        {
          method: 'POST',
          headers: {
            'Authorization': (client as any).token,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
          },
          body: formData.toString(),
        }
      );

      const result = await response.json();
      if (result.error) throw new Error(JSON.stringify(result.error));
      return result;
    },
  },
};
