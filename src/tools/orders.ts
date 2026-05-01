import { z } from "zod";
import type { SevdeskClient } from "../client.js";

export const orderTools = {
  list_orders: {
    description: "List all orders (estimates/proposals, order confirmations, delivery notes) from sevdesk. Use orderType='AN' for estimates/proposals (Angebote).",
    inputSchema: z.object({
      orderType: z.enum(["AN", "AB", "LI"]).optional().describe("Order type: AN=Estimate/Proposal (Angebot), AB=Order confirmation (Auftragsbestätigung), LI=Delivery note (Lieferschein)"),
      status: z.enum(["100", "200", "300", "500", "750", "1000"]).optional().describe("Order status: 100=Draft, 200=Delivered, 300=Rejected/Cancelled, 500=Accepted, 750=Partially calculated, 1000=Calculated"),
      orderNumber: z.string().optional().describe("Filter by order number"),
      startDate: z.string().optional().describe("Filter by start date (Unix timestamp)"),
      endDate: z.string().optional().describe("Filter by end date (Unix timestamp)"),
      contactId: z.number().optional().describe("Filter by contact ID"),
      limit: z.number().optional().describe("Limit the number of results"),
      offset: z.number().optional().describe("Skip a number of results"),
    }),
    handler: async (client: SevdeskClient, params: {
      orderType?: "AN" | "AB" | "LI";
      status?: "100" | "200" | "300" | "500" | "750" | "1000";
      orderNumber?: string;
      startDate?: string;
      endDate?: string;
      contactId?: number;
      limit?: number;
      offset?: number;
    }) => {
      const queryParams: Record<string, any> = {};
      if (params.orderType) queryParams.orderType = params.orderType;
      if (params.status) queryParams.status = Number(params.status);
      if (params.orderNumber) queryParams.orderNumber = params.orderNumber;
      if (params.startDate) queryParams.startDate = Number(params.startDate);
      if (params.endDate) queryParams.endDate = Number(params.endDate);
      if (params.contactId) {
        queryParams["contact[id]"] = params.contactId;
        queryParams["contact[objectName]"] = "Contact";
      }
      if (params.limit) queryParams.limit = params.limit;
      if (params.offset) queryParams.offset = params.offset;

      const { data, error } = await client.GET("/Order", {
        params: { query: queryParams as any },
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  get_order: {
    description: "Get a specific order by ID from sevdesk",
    inputSchema: z.object({
      orderId: z.number().describe("The ID of the order to retrieve"),
    }),
    handler: async (client: SevdeskClient, params: { orderId: number }) => {
      const { data, error } = await client.GET("/Order/{orderId}", {
        params: {
          path: { orderId: params.orderId },
        },
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  get_order_positions: {
    description: "Get all positions (line items) of an order",
    inputSchema: z.object({
      orderId: z.number().describe("The ID of the order"),
    }),
    handler: async (client: SevdeskClient, params: { orderId: number }) => {
      const { data, error } = await client.GET("/Order/{orderId}/getPositions", {
        params: {
          path: { orderId: params.orderId },
        },
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  get_order_pdf: {
    description: "Get the PDF of an order as base64 encoded string",
    inputSchema: z.object({
      orderId: z.number().describe("The ID of the order"),
      download: z.boolean().optional().describe("Whether to download the PDF"),
      preventSendBy: z.boolean().optional().describe("Prevent setting sendBy date"),
    }),
    handler: async (client: SevdeskClient, params: {
      orderId: number;
      download?: boolean;
      preventSendBy?: boolean;
    }) => {
      const { data, error } = await client.GET("/Order/{orderId}/getPdf", {
        params: {
          path: { orderId: params.orderId },
          query: {
            download: params.download,
            preventSendBy: params.preventSendBy,
          },
        },
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  create_order: {
    description: "Create a new order (estimate/proposal, order confirmation, or delivery note) in sevdesk. Use orderType='AN' for estimates/proposals (Angebote).",
    inputSchema: z.object({
      orderType: z.enum(["AN", "AB", "LI"]).describe("Order type: AN=Estimate/Proposal (Angebot), AB=Order confirmation, LI=Delivery note"),
      contactId: z.number().describe("The ID of the contact (customer)"),
      orderNumber: z.string().describe("The order number (e.g., 'AN-1001')"),
      header: z.string().describe("The order header (e.g., 'Angebot Nr. AN-1001')"),
      orderDate: z.string().describe("The order date (ISO date string YYYY-MM-DD)"),
      status: z.enum(["100", "200"]).optional().describe("Order status: 100=Draft, 200=Delivered. Default: 100"),
      headText: z.string().optional().describe("Header text for the order (can contain HTML)"),
      footText: z.string().optional().describe("Footer text for the order (can contain HTML)"),
      address: z.string().optional().describe("Complete address (use \\n for line breaks)"),
      currency: z.string().optional().describe("Currency code (default: EUR)"),
      customerInternalNote: z.string().optional().describe("Internal note (e.g., reference number)"),
      showNet: z.boolean().optional().describe("If true, prices are net prices. Default: true"),
      taxType: z.enum(["default", "eu", "noteu", "ss"]).optional().describe("Tax type: default, eu, noteu, ss"),
      taxText: z.string().optional().describe("Tax text (e.g., 'zzgl. 19% USt.')"),
      contactPersonId: z.number().optional().describe("ID of the sevdesk user as contact person"),
    }),
    handler: async (client: SevdeskClient, params: {
      orderType: "AN" | "AB" | "LI";
      contactId: number;
      orderNumber: string;
      header: string;
      orderDate: string;
      status?: "100" | "200";
      headText?: string;
      footText?: string;
      address?: string;
      currency?: string;
      customerInternalNote?: string;
      showNet?: boolean;
      taxType?: "default" | "eu" | "noteu" | "ss";
      taxText?: string;
      contactPersonId?: number;
    }) => {
      const body: Record<string, any> = {
        order: {
          objectName: "Order",
          orderType: params.orderType,
          contact: {
            id: params.contactId,
            objectName: "Contact",
          },
          orderNumber: params.orderNumber,
          header: params.header,
          orderDate: params.orderDate,
          status: params.status ? Number(params.status) : 100,
          version: 0,
          currency: params.currency || "EUR",
          taxType: params.taxType || "default",
          taxText: params.taxText || "zzgl. 19% USt.",
          showNet: params.showNet !== false ? "1" : "0",
          mapAll: true,
        },
        orderPosSave: [],
        orderPosDelete: null,
      };

      if (params.headText) body.order.headText = params.headText;
      if (params.footText) body.order.footText = params.footText;
      if (params.address) body.order.address = params.address;
      if (params.customerInternalNote) body.order.customerInternalNote = params.customerInternalNote;
      if (params.contactPersonId) {
        body.order.contactPerson = {
          id: params.contactPersonId,
          objectName: "SevUser",
        };
      }

      const { data, error } = await client.POST("/Order/Factory/saveOrder", {
        body: body as any,
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  add_order_position: {
    description: "Add a position (line item) to an existing order. This retrieves the order, adds the position, and saves it.",
    inputSchema: z.object({
      orderId: z.number().describe("The ID of the order"),
      name: z.string().describe("Name/description of the position"),
      quantity: z.number().describe("Quantity"),
      price: z.number().describe("Price per unit (net or gross depending on order's showNet setting)"),
      taxRate: z.number().describe("Tax rate (e.g., 19 for 19%)"),
      unity: z.number().optional().describe("Unity ID (default: 1 for 'Stück')"),
      text: z.string().optional().describe("Additional text for the position"),
      discount: z.number().optional().describe("Discount in percent"),
      partId: z.number().optional().describe("ID of a part/product from inventory"),
    }),
    handler: async (client: SevdeskClient, params: {
      orderId: number;
      name: string;
      quantity: number;
      price: number;
      taxRate: number;
      unity?: number;
      text?: string;
      discount?: number;
      partId?: number;
    }) => {
      // Get existing order and positions
      const { data: orderData, error: orderError } = await client.GET("/Order/{orderId}", {
        params: { path: { orderId: params.orderId } },
      });
      if (orderError) throw new Error(JSON.stringify(orderError));

      const { data: posData, error: posError } = await client.GET("/Order/{orderId}/getPositions", {
        params: { path: { orderId: params.orderId } },
      });
      if (posError) throw new Error(JSON.stringify(posError));

      const order = (orderData as any).objects?.[0] || orderData;
      const existingPositions = (posData as any).objects || [];

      // Add new position - must include order reference
      const newPosition: Record<string, any> = {
        objectName: "OrderPos",
        mapAll: true,
        order: { id: params.orderId, objectName: "Order" },
        name: params.name,
        quantity: params.quantity,
        price: params.price,
        taxRate: params.taxRate,
        unity: { id: params.unity || 1, objectName: "Unity" },
        positionNumber: existingPositions.length,
      };
      if (params.text) newPosition.text = params.text;
      if (params.discount) newPosition.discount = params.discount;
      if (params.partId) {
        newPosition.part = { id: params.partId, objectName: "Part" };
      }

      // Save order with all positions - existing ones just need id reference
      const body = {
        order: {
          id: params.orderId,
          objectName: "Order",
          mapAll: true,
        },
        orderPosSave: [
          ...existingPositions.map((pos: any) => ({
            id: pos.id,
            objectName: "OrderPos",
          })),
          newPosition,
        ],
        orderPosDelete: null,
      };

      const { data, error } = await client.POST("/Order/Factory/saveOrder", {
        body: body as any,
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  update_order: {
    description: "Update an existing order",
    inputSchema: z.object({
      orderId: z.number().describe("The ID of the order to update"),
      status: z.enum(["100", "200", "300", "500"]).optional().describe("Order status: 100=Draft, 200=Delivered, 300=Rejected, 500=Accepted"),
      header: z.string().optional().describe("The order header"),
      headText: z.string().optional().describe("Header text"),
      footText: z.string().optional().describe("Footer text"),
      address: z.string().optional().describe("Complete address"),
      customerInternalNote: z.string().optional().describe("Internal note"),
    }),
    handler: async (client: SevdeskClient, params: {
      orderId: number;
      status?: "100" | "200" | "300" | "500";
      header?: string;
      headText?: string;
      footText?: string;
      address?: string;
      customerInternalNote?: string;
    }) => {
      const body: Record<string, any> = {};
      if (params.status) body.status = Number(params.status);
      if (params.header) body.header = params.header;
      if (params.headText) body.headText = params.headText;
      if (params.footText) body.footText = params.footText;
      if (params.address) body.address = params.address;
      if (params.customerInternalNote) body.customerInternalNote = params.customerInternalNote;

      const { data, error } = await client.PUT("/Order/{orderId}", {
        params: {
          path: { orderId: params.orderId },
        },
        body: body as any,
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  send_order_by_email: {
    description: "Send an order via email",
    inputSchema: z.object({
      orderId: z.number().describe("The ID of the order to send"),
      toEmail: z.string().describe("Recipient email address"),
      subject: z.string().describe("Email subject"),
      text: z.string().describe("Email body text"),
      copy: z.boolean().optional().describe("Send a copy to your own email"),
      ccEmail: z.string().optional().describe("CC email address"),
      bccEmail: z.string().optional().describe("BCC email address"),
    }),
    handler: async (client: SevdeskClient, params: {
      orderId: number;
      toEmail: string;
      subject: string;
      text: string;
      copy?: boolean;
      ccEmail?: string;
      bccEmail?: string;
    }) => {
      const { data, error } = await client.POST("/Order/{orderId}/sendViaEmail", {
        params: {
          path: { orderId: params.orderId },
        },
        body: {
          toEmail: params.toEmail,
          subject: params.subject,
          text: params.text,
          copy: params.copy,
          ccEmail: params.ccEmail,
          bccEmail: params.bccEmail,
        } as any,
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  duplicate_order: {
    description: "Duplicate an existing order to create a new one (useful for creating similar estimates/proposals)",
    inputSchema: z.object({
      orderId: z.number().describe("The ID of the order to duplicate"),
      newOrderNumber: z.string().describe("The order number for the new order"),
      newContactId: z.number().optional().describe("Optionally use a different contact"),
    }),
    handler: async (client: SevdeskClient, params: {
      orderId: number;
      newOrderNumber: string;
      newContactId?: number;
    }) => {
      // First get the original order
      const { data: orderData, error: orderError } = await client.GET("/Order/{orderId}", {
        params: { path: { orderId: params.orderId } },
      });
      if (orderError) throw new Error(JSON.stringify(orderError));

      // Get positions
      const { data: posData, error: posError } = await client.GET("/Order/{orderId}/getPositions", {
        params: { path: { orderId: params.orderId } },
      });
      if (posError) throw new Error(JSON.stringify(posError));

      const original = (orderData as any).objects?.[0] || orderData;
      const positions = (posData as any).objects || [];

      // Create new order with positions
      const newOrder: Record<string, any> = {
        order: {
          objectName: "Order",
          orderType: original.orderType,
          contact: params.newContactId 
            ? { id: params.newContactId, objectName: "Contact" }
            : original.contact,
          orderNumber: params.newOrderNumber,
          header: original.header?.replace(original.orderNumber, params.newOrderNumber) || `Angebot Nr. ${params.newOrderNumber}`,
          orderDate: new Date().toISOString().split("T")[0],
          status: 100,
          version: 0,
          currency: original.currency || "EUR",
          taxType: original.taxType || "default",
          taxText: original.taxText,
          showNet: original.showNet,
          headText: original.headText,
          footText: original.footText,
          address: params.newContactId ? undefined : original.address,
          mapAll: true,
        },
        orderPosSave: positions.map((pos: any, idx: number) => ({
          objectName: "OrderPos",
          name: pos.name,
          quantity: pos.quantity,
          price: pos.price,
          taxRate: pos.taxRate,
          unity: pos.unity,
          positionNumber: idx,
          text: pos.text,
          discount: pos.discount,
          part: pos.part,
        })),
        orderPosDelete: null,
      };

      const { data, error } = await client.POST("/Order/Factory/saveOrder", {
        body: newOrder as any,
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  },

  delete_order_position: {
    description: "Delete a position from an order by saving the order without that position",
    inputSchema: z.object({
      orderId: z.number().describe("The ID of the order"),
      orderPosId: z.number().describe("The ID of the order position to delete"),
    }),
    handler: async (client: SevdeskClient, params: { orderId: number; orderPosId: number }) => {
      // Get existing positions
      const { data: posData, error: posError } = await client.GET("/Order/{orderId}/getPositions", {
        params: { path: { orderId: params.orderId } },
      });
      if (posError) throw new Error(JSON.stringify(posError));

      const positions = (posData as any).objects || [];
      const remainingPositions = positions.filter((pos: any) => pos.id !== params.orderPosId);

      if (remainingPositions.length === positions.length) {
        throw new Error(`Position with ID ${params.orderPosId} not found in order ${params.orderId}`);
      }

      // Save order with remaining positions
      const body = {
        order: {
          id: params.orderId,
          objectName: "Order",
        },
        orderPosSave: remainingPositions.map((pos: any) => ({
          id: pos.id,
          objectName: "OrderPos",
        })),
        orderPosDelete: [{
          id: params.orderPosId,
          objectName: "OrderPos",
        }],
      };

      const { data, error } = await client.POST("/Order/Factory/saveOrder", {
        body: body as any,
      });
      if (error) throw new Error(JSON.stringify(error));
      return { success: true, message: "Position deleted", data };
    },
  },
};
