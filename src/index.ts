import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PrivyClient } from "@privy-io/server-auth";
interface PrivyWalletCreationRequest {
  owner: { userId: string };
  chainType: "cosmos" | "stellar" | "sui" | "tron" | "solana" | "ethereum";
  idempotencyKey?: string;
}


export interface Env {
  // Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
  // MY_KV_NAMESPACE: KVNamespace;
  //
  // Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
  // MY_DURABLE_OBJECT: DurableObjectNamespace;
  //
  // Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
  // MY_BUCKET: R2Bucket;
  //
  // Example binding to a Service. Learn more at https://developers.cloudflare.com/workers/runtime-apis/service-bindings/
  // MY_SERVICE: Fetcher;
  //
  // Example binding to a Queue. Learn more at https://developers.cloudflare.com/queues/javascript-apis/
  // MY_QUEUE: Queue;
  //
  // Example binding to a Global Namespace. Learn more at https://developers.cloudflare.com/workers/runtime-apis/global-namespace/
  // MY_GLOBAL_NAMESPACE: any;
  //
  // Example binding to a Workers AI model. Learn more at https://developers.cloudflare.com/workers-ai/
  AI: Ai;
  PRIVY_APP_ID: string;
  PRIVY_APP_SECRET: string;
}

// Define our MCP agent with tools
export class MyMCP extends McpAgent {
	server = new McpServer({
		name: "Privy Wallet MCP",
		version: "1.0.0",
	});

	async init() {
		// Placeholder tool for Privy wallet management
		this.server.tool(
			"get_wallet_address",
			{ userId: z.string() },
			async ({ userId }) => {
				// In a real implementation, this would interact with Privy to get the user's wallet address
				const walletAddress = `0x${userId.slice(0, 40).padEnd(40, '0')}`; // Mock address
				return { content: [{ type: "text", text: `Wallet address for ${userId}: ${walletAddress}` }] };
			}
		);

		this.server.tool(
			"get_wallet_details",
			{ walletId: z.string() },
			async ({ walletId }) => {
				try {
					const env = this.env as Env;
					console.log(`[get_wallet_details] PRIVY_APP_ID: ${env.PRIVY_APP_ID ? 'Set' : 'Not Set'}`);
					const privy = new PrivyClient(env.PRIVY_APP_ID, env.PRIVY_APP_SECRET);
					const wallet = await privy.walletApi.getWallet({ id: walletId });
					if (!wallet) {
						return { content: [{ type: "text", text: "Wallet not found" }] };
					}
					return { content: [{ type: "text", text: JSON.stringify(wallet) }] };
				} catch (error) {
					return { content: [{ type: "text", text: `Error fetching wallet details: ${(error as Error).message}` }] };
				}
			}
		);

		this.server.tool(
			"create_wallet",
			{
				userId: z.string(),
				chainType: z.enum(["cosmos", "stellar", "sui", "tron", "solana", "ethereum"]),
				idempotencyKey: z.string().optional(),
			},
			async ({ userId, chainType, idempotencyKey }) => {
				try {
					const env = this.env as Env;
					console.log(`[create_wallet] PRIVY_APP_ID: ${env.PRIVY_APP_ID ? 'Set' : 'Not Set'}`);
					const privy = new PrivyClient(env.PRIVY_APP_ID, env.PRIVY_APP_SECRET);
					const wallet = await privy.walletApi.createWallet({
						owner: { userId },
						chainType,
						idempotencyKey,
					});
					return { content: [{ type: "text", text: JSON.stringify(wallet) }] };
				} catch (error) {
					return { content: [{ type: "text", text: `Error creating wallet: ${(error as Error).message}` }] };
				}
			}
		);

		this.server.tool(
			"import_user",
			{
				email: z.string().optional(),
				phone_number: z.string().optional(),
				external_id: z.string().optional(),
				metadata: z.record(z.any()).optional(),
			},
			async ({ email, phone_number, external_id, metadata }) => {
				try {
					const env = this.env as Env;
					console.log(`[import_user] PRIVY_APP_ID: ${env.PRIVY_APP_ID ? 'Set' : 'Not Set'}`);
					const privy = new PrivyClient(env.PRIVY_APP_ID, env.PRIVY_APP_SECRET);
					const linkedAccounts: any[] = [];
					if (email) {
						linkedAccounts.push({ type: 'email', address: email });
					}
					if (phone_number) {
						linkedAccounts.push({ type: 'phone', number: phone_number });
					}
					if (external_id) {
						linkedAccounts.push({ type: 'custom_auth', customUserId: external_id });
					}

					const user = await privy.importUser({
						linkedAccounts,
						customMetadata: metadata,
					});
					return { content: [{ type: "text", text: JSON.stringify({ userId: user.id }) }] };
				} catch (error) {
					return { content: [{ type: "text", text: `Error importing user: ${(error as Error).message}` }] };
				}
			}
		);
	}
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		// Initialize PrivyClient
		const privy = new PrivyClient(env.PRIVY_APP_ID, env.PRIVY_APP_SECRET);

		// Handle specific paths
		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			return MyMCP.serveSSE("/sse").fetch(request, env, ctx);
		}

		if (url.pathname === "/mcp") {
			return MyMCP.serve("/mcp").fetch(request, env, ctx);
		}

		// Handle API routes
		if (url.pathname.startsWith("/v1/wallets/")) {
			switch (request.method) {
				case "GET":
					try {
						const walletId = url.pathname.split("/")[3];
						if (!walletId) {
							return new Response(JSON.stringify({ error: "Wallet ID is required" }), {
								headers: { "Content-Type": "application/json" },
								status: 400,
							});
						}
						const wallet = await privy.walletApi.getWallet({ id: walletId });
						if (!wallet) {
							return new Response(JSON.stringify({ error: "Wallet not found" }), {
								headers: { "Content-Type": "application/json" },
								status: 404,
							});
						}
						return new Response(JSON.stringify(wallet), {
							headers: { "Content-Type": "application/json" },
							status: 200,
						});
					} catch (error) {
						return new Response(JSON.stringify({ error: (error as Error).message }), {
							headers: { "Content-Type": "application/json" },
							status: 500,
						});
					}
				default:
					return new Response("Method Not Allowed", { status: 405 });
			}
		} else if (url.pathname.startsWith("/v1/")) {
			switch (request.method) {
				case "POST":
					switch (url.pathname) {
						case "/v1/wallets":
							try {
								const { owner, chainType, idempotencyKey } = await request.json() as PrivyWalletCreationRequest;
								const wallet = await privy.walletApi.createWallet({
									owner,
									chainType,
									idempotencyKey,
								});
								return new Response(JSON.stringify(wallet), {
									headers: { "Content-Type": "application/json" },
									status: 201,
								});
							} catch (error) {
								return new Response(JSON.stringify({ error: (error as Error).message }), {
									headers: { "Content-Type": "application/json" },
									status: 400,
								});
							}
						case "/v1/users":
							console.log("Received POST request for /v1/users");
							try {
								const requestBody = await request.json();
								console.log("Request body:", JSON.stringify(requestBody));
								const { email, phone_number, external_id, metadata } = requestBody as {
									email?: string;
									phone_number?: string;
									external_id?: string;
									metadata?: Record<string, any>;
								};

								const linkedAccounts: any[] = [];
								if (email) {
									linkedAccounts.push({ type: 'email', address: email });
								}
								if (phone_number) {
									linkedAccounts.push({ type: 'phone', number: phone_number });
								}
								if (external_id) {
									linkedAccounts.push({ type: 'custom_auth', customUserId: external_id });
								}

								const user = await privy.importUser({
									linkedAccounts,
									customMetadata: metadata,
								});
								return new Response(JSON.stringify({ userId: user.id }), {
									headers: { "Content-Type": "application/json" },
									status: 201,
								});
							} catch (error) {
								return new Response(JSON.stringify({ error: (error as Error).message }), {
									headers: { "Content-Type": "application/json" },
									status: 400,
								});
							}
						default:
							return new Response("Not found", { status: 404 });
					}
				default:
					return new Response("Method Not Allowed", { status: 405 });
			}
		}

		// Default response for unmatched routes
		return new Response("Not found", { status: 404 });
	},
};