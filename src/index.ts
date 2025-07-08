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
				try {
					const env = this.env as Env;
					const privy = new PrivyClient(env.PRIVY_APP_ID, env.PRIVY_APP_SECRET);
					const user = await privy.getUser(userId); // Assuming getUser exists and returns user object
					if (!user || !user.linkedAccounts) {
						return { content: [{ type: "text", text: `No user or linked accounts found for user ${userId}` }] };
					}

					const linkedWallets = user.linkedAccounts.filter(
						(account: any) => account.type === 'wallet' || account.type === 'evm_wallet' || account.type === 'sol_wallet'
					);

					if (!linkedWallets || linkedWallets.length === 0) {
						return { content: [{ type: "text", text: `No linked wallets found for user ${userId}` }] };
					}
					return { content: [{ type: "text", text: JSON.stringify(linkedWallets) }] };
				} catch (error) {
					return { content: [{ type: "text", text: `Error fetching wallets for user ${userId}: ${(error as Error).message}` }] };
				}
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
			"get_wallet_balance",
			{
				walletId: z.string(),
				asset: z.string().optional(),
				chain: z.string().optional(),
				include_currency: z.string().optional(),
			},
			async ({ walletId, asset, chain, include_currency }) => {
				try {
					const env = this.env as Env;
					const searchParams = new URLSearchParams();
					if (asset) searchParams.append('asset', asset);
					if (chain) searchParams.append('chain', chain);
					if (include_currency) searchParams.append('include_currency', include_currency);

					const privyApiUrl = `https://api.privy.io/v1/wallets/${walletId}/balance?${searchParams.toString()}`;

					const options = {
						method: 'GET',
						headers: {
							'Authorization': 'Basic ' + btoa(`${env.PRIVY_APP_ID}:${env.PRIVY_APP_SECRET}`),
							'privy-app-id': env.PRIVY_APP_ID
						}
					};

					const privyResponse = await fetch(privyApiUrl, options);
					const responseBody = await privyResponse.json();

					if (!privyResponse.ok) {
						return { content: [{ type: "text", text: `Error from Privy API: ${JSON.stringify(responseBody)}` }] };
					}

					return { content: [{ type: "text", text: JSON.stringify(responseBody) }] };
				} catch (error) {
					return { content: [{ type: "text", text: `Error fetching wallet balance: ${(error as Error).message}` }] };
				}
			}
		);

		this.server.tool(
			"get_wallet_transactions",
			{
				walletId: z.string(),
				asset: z.string().optional(),
				chain: z.string().optional(),
			},
			async ({ walletId, asset, chain }) => {
				try {
					const env = this.env as Env;
					const searchParams = new URLSearchParams();
					if (asset) searchParams.append('asset', asset);
					if (chain) searchParams.append('chain', chain);

					const privyApiUrl = `https://api.privy.io/v1/wallets/${walletId}/transactions?${searchParams.toString()}`;

					const options = {
						method: 'GET',
						headers: {
							'Authorization': 'Basic ' + btoa(`${env.PRIVY_APP_ID}:${env.PRIVY_APP_SECRET}`),
							'privy-app-id': env.PRIVY_APP_ID
						}
					};

					const privyResponse = await fetch(privyApiUrl, options);
					const responseBody = await privyResponse.json();

					if (!privyResponse.ok) {
						return { content: [{ type: "text", text: `Error from Privy API: ${JSON.stringify(responseBody)}` }] };
					}

					return { content: [{ type: "text", text: JSON.stringify(responseBody) }] };
				} catch (error) {
					return { content: [{ type: "text", text: `Error fetching wallet transactions: ${(error as Error).message}` }] };
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
			if (url.pathname.endsWith("/balance")) {
				// Handle GET /v1/wallets/{wallet_id}/balance
				if (request.method === "GET") {
					try {
						const walletId = url.pathname.split("/")[3];
						if (!walletId) {
							return new Response(JSON.stringify({ error: "Wallet ID is required" }), {
								headers: { "Content-Type": "application/json" },
								status: 400,
							});
						}

						const asset = url.searchParams.get('asset');
						const chain = url.searchParams.get('chain');
						const include_currency = url.searchParams.get('include_currency');

						const searchParams = new URLSearchParams();
						if (asset) searchParams.append('asset', asset);
						if (chain) searchParams.append('chain', chain);
						if (include_currency) searchParams.append('include_currency', include_currency);

						const privyApiUrl = `https://api.privy.io/v1/wallets/${walletId}/balance?${searchParams.toString()}`;

						const options = {
							method: 'GET',
							headers: {
								'Authorization': 'Basic ' + btoa(`${env.PRIVY_APP_ID}:${env.PRIVY_APP_SECRET}`),
								'privy-app-id': env.PRIVY_APP_ID
							}
						};

						const privyResponse = await fetch(privyApiUrl, options);
						const responseBody = await privyResponse.json();

						if (!privyResponse.ok) {
							return new Response(JSON.stringify({ error: `Error from Privy API: ${JSON.stringify(responseBody)}` }), {
								headers: { "Content-Type": "application/json" },
								status: privyResponse.status,
							});
						}

						return new Response(JSON.stringify(responseBody), {
							headers: { "Content-Type": "application/json" },
							status: 200,
						});

					} catch (error) {
						return new Response(JSON.stringify({ error: (error as Error).message }), {
							headers: { "Content-Type": "application/json" },
							status: 500,
						});
					}
				} else {
					return new Response("Method Not Allowed", { status: 405 });
				}
			} else if (url.pathname.endsWith("/transactions")) {
				// Handle GET /v1/wallets/{wallet_id}/transactions
				if (request.method === "GET") {
					try {
						const walletId = url.pathname.split("/")[3];
						if (!walletId) {
							return new Response(JSON.stringify({ error: "Wallet ID is required" }), {
								headers: { "Content-Type": "application/json" },
								status: 400,
							});
						}

						const asset = url.searchParams.get('asset');
						const chain = url.searchParams.get('chain');

						const searchParams = new URLSearchParams();
						if (asset) searchParams.append('asset', asset);
						if (chain) searchParams.append('chain', chain);

						const privyApiUrl = `https://api.privy.io/v1/wallets/${walletId}/transactions?${searchParams.toString()}`;

						const options = {
							method: 'GET',
							headers: {
								'Authorization': 'Basic ' + btoa(`${env.PRIVY_APP_ID}:${env.PRIVY_APP_SECRET}`),
								'privy-app-id': env.PRIVY_APP_ID
							}
						};

						const privyResponse = await fetch(privyApiUrl, options);
						const responseBody = await privyResponse.json();

						if (!privyResponse.ok) {
							return new Response(JSON.stringify({ error: `Error from Privy API: ${JSON.stringify(responseBody)}` }), {
								headers: { "Content-Type": "application/json" },
								status: privyResponse.status,
							});
						}

						return new Response(JSON.stringify(responseBody), {
							headers: { "Content-Type": "application/json" },
							status: 200,
						});

					} catch (error) {
						return new Response(JSON.stringify({ error: (error as Error).message }), {
							headers: { "Content-Type": "application/json" },
							status: 500,
						});
					}
				} else {
					return new Response("Method Not Allowed", { status: 405 });
				}
			}
			else {
				// Existing GET /v1/wallets/{wallet_id}
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
			}
		}
		else if (url.pathname.startsWith("/v1/")) {
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
		else if (url.pathname.startsWith("/v1/")) {
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