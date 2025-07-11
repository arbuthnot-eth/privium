import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PrivyClient, SolanaCaip2ChainId } from "@privy-io/server-auth";
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

	async init(): Promise<void> {
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

		this.server.tool(
			"create_key_quorum",
			{
				displayName: z.string(),
				publicKeys: z.array(z.string()),
				authorizationThreshold: z.number().optional(),
			},
			async ({ displayName, publicKeys, authorizationThreshold }) => {
				try {
					const env = this.env as Env;
					const privyApiUrl = `https://api.privy.io/v1/key_quorums`;
					const options = {
						method: 'POST',
						headers: {
							'Authorization': 'Basic ' + btoa(`${env.PRIVY_APP_ID}:${env.PRIVY_APP_SECRET}`),
							'privy-app-id': env.PRIVY_APP_ID,
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							display_name: displayName,
							public_keys: publicKeys,
							authorization_threshold: authorizationThreshold,
						}),
					};
					const privyResponse = await fetch(privyApiUrl, options);
					const responseBody = await privyResponse.json();
					if (!privyResponse.ok) {
						return { content: [{ type: "text", text: `Error from Privy API: ${JSON.stringify(responseBody)}` }] };
					}
					return { content: [{ type: "text", text: `Key quorum created. Response: ${JSON.stringify(responseBody)}` }] };
				} catch (error) {
					return { content: [{ type: "text", text: `Error creating key quorum: ${(error as Error).message}` }] };
				}
			}
		);

		this.server.tool(
			"add_session_signer",
			{
				address: z.string(),
				signerId: z.string(),
			},
			async ({ address, signerId }) => {
				// This tool is a placeholder for the client-side action.
				// In a real application, this would trigger a UI flow
				// where the user consents to adding the session signer.
				return {
					content: [{
						type: "text",
						text: `To add the session signer, you would typically call the 'addSessionSigners' method from the Privy React SDK on the client-side with the following parameters: address: '${address}', signers: [{ signerId: '${signerId}' }]`
					}]
				};
			}
		);

		this.server.tool(
			"personal_sign",
			{
				walletId: z.string(),
				message: z.string(),
			},
			async ({ walletId, message }) => {
				try {
					const env = this.env as Env;
					const privy = new PrivyClient(env.PRIVY_APP_ID, env.PRIVY_APP_SECRET);
					const responseBody = await privy.walletApi.ethereum.signMessage({
						walletId,
						message,
					});
					return { content: [{ type: "text", text: JSON.stringify({ method: 'personal_sign', data: responseBody }) }] };
				} catch (error) {
					return { content: [{ type: "text", text: `Error signing message: ${(error as Error).message}` }] };
				}
			}
		);

		this.server.tool(
			"sign_typed_data",
			{
				walletId: z.string(),
				typedData: z.any(),
			},
			async ({ walletId, typedData }) => {
				try {
					const env = this.env as Env;
					const privy = new PrivyClient(env.PRIVY_APP_ID, env.PRIVY_APP_SECRET);
					const responseBody = await privy.walletApi.ethereum.signTypedData({
						walletId,
						typedData,
					});
					return { content: [{ type: "text", text: JSON.stringify({ method: 'eth_signTypedData_v4', data: responseBody }) }] };
				} catch (error) {
					return { content: [{ type: "text", text: `Error signing typed data: ${(error as Error).message}` }] };
				}
			}
		);

		this.server.tool(
			"secp256k1_sign",
			{
				walletId: z.string(),
				hash: z.string().refine((val): val is `0x${string}` => val.startsWith('0x')),
			},
			async ({ walletId, hash }) => {
				try {
					const env = this.env as Env;
					const privy = new PrivyClient(env.PRIVY_APP_ID, env.PRIVY_APP_SECRET);
					const responseBody = await privy.walletApi.ethereum.secp256k1Sign({
						walletId,
						hash,
					});
					return { content: [{ type: "text", text: JSON.stringify({ method: 'secp256k1_sign', data: responseBody }) }] };
				} catch (error) {
					return { content: [{ type: "text", text: `Error with secp256k1 sign: ${(error as Error).message}` }] };
				}
			}
		);

		this.server.tool(
			"solana_sign_message",
			{
				walletId: z.string(),
				message: z.string(),
			},
			async ({ walletId, message }) => {
				try {
					const env = this.env as Env;
					const privy = new PrivyClient(env.PRIVY_APP_ID, env.PRIVY_APP_SECRET);
					const responseBody = await privy.walletApi.solana.signMessage({
						walletId,
						message,
					});
					return { content: [{ type: "text", text: JSON.stringify({ method: 'signMessage', data: responseBody }) }] };
				} catch (error) {
					return { content: [{ type: "text", text: `Error signing Solana message: ${(error as Error).message}` }] };
				}
			}
		);

		this.server.tool(
			"ethereum_send_transaction",
			{
				walletId: z.string(),
				caip2: z.string().refine((val): val is `eip155:${string}` => val.startsWith('eip155:')),
				transaction: z.any(),
			},
			async ({ walletId, caip2, transaction }) => {
				try {
					const env = this.env as Env;
					const privy = new PrivyClient(env.PRIVY_APP_ID, env.PRIVY_APP_SECRET);
					const responseBody = await privy.walletApi.ethereum.sendTransaction({
						walletId,
						caip2,
						transaction,
					});
					return { content: [{ type: "text", text: JSON.stringify({ method: 'eth_sendTransaction', data: responseBody }) }] };
				} catch (error) {
					return { content: [{ type: "text", text: `Error sending Ethereum transaction: ${(error as Error).message}` }] };
				}
			}
		);

		this.server.tool(
			"ethereum_sign_transaction",
			{
				walletId: z.string(),
				transaction: z.any(),
			},
			async ({ walletId, transaction }) => {
				try {
					const env = this.env as Env;
					const privy = new PrivyClient(env.PRIVY_APP_ID, env.PRIVY_APP_SECRET);
					const responseBody = await privy.walletApi.ethereum.signTransaction({
						walletId,
						transaction,
					});
					return { content: [{ type: "text", text: JSON.stringify({ method: 'eth_signTransaction', data: responseBody }) }] };
				} catch (error) {
					return { content: [{ type: "text", text: `Error signing Ethereum transaction: ${(error as Error).message}` }] };
				}
			}
		);

		this.server.tool(
			"ethereum_sign_7702_authorization",
			{
				walletId: z.string(),
				contract: z.string().refine((val): val is `0x${string}` => val.startsWith('0x')),
				chainId: z.number(),
				nonce: z.string(), // Assuming nonce is a string that can be converted to Quantity
			},
			async ({ walletId, contract, chainId, nonce }) => {
				try {
					const env = this.env as Env;
					const privy = new PrivyClient(env.PRIVY_APP_ID, env.PRIVY_APP_SECRET);
					const responseBody = await privy.walletApi.ethereum.sign7702Authorization({
						walletId,
						contract,
						chainId,
						nonce: nonce as `0x${string}`, // Casting here, assuming validation is sufficient
					});
					return { content: [{ type: "text", text: JSON.stringify({ method: 'eth_sign7702Authorization', data: responseBody }) }] };
				} catch (error) {
					return { content: [{ type: "text", text: `Error signing 7702 authorization: ${(error as Error).message}` }] };
				}
			}
		);

		this.server.tool(
			"solana_sign_and_send_transaction",
			{
				walletId: z.string(),
				caip2: z.custom<SolanaCaip2ChainId>((val) => {
					return typeof val === 'string' && val.startsWith('solana:');
				}),
				transaction: z.any(),
			},
			async ({ walletId, caip2, transaction }) => {
				try {
					const env = this.env as Env;
					const privy = new PrivyClient(env.PRIVY_APP_ID, env.PRIVY_APP_SECRET);
					const responseBody = await privy.walletApi.solana.signAndSendTransaction({
						walletId,
						caip2,
						transaction,
					});
					return { content: [{ type: "text", text: JSON.stringify({ method: 'signAndSendTransaction', data: responseBody }) }] };
				} catch (error) {
					return { content: [{ type: "text", text: `Error signing and sending Solana transaction: ${(error as Error).message}` }] };
				}
			}
		);

		this.server.tool(
			"solana_sign_transaction",
			{
				walletId: z.string(),
				transaction: z.any(),
			},
			async ({ walletId, transaction }) => {
				try {
					const env = this.env as Env;
					const privy = new PrivyClient(env.PRIVY_APP_ID, env.PRIVY_APP_SECRET);
					const responseBody = await privy.walletApi.solana.signTransaction({
						walletId,
						transaction,
					});
					return { content: [{ type: "text", text: JSON.stringify({ method: 'signTransaction', data: responseBody }) }] };
				} catch (error) {
					return { content: [{ type: "text", text: `Error signing Solana transaction: ${(error as Error).message}` }] };
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
			} else if (url.pathname.endsWith("/rpc")) {
				// Handle POST /v1/wallets/{wallet_id}/rpc for message signing
				if (request.method === "POST") {
					try {
						const walletId = url.pathname.split("/")[3];
						if (!walletId) {
							return new Response(JSON.stringify({ error: "Wallet ID is required" }), {
								headers: { "Content-Type": "application/json" },
								status: 400,
							});
						}

						const { method, params } = await request.json() as { method: string; params: any };

						let responseBody: any;
						switch (method) {
							case "personal_sign":
								responseBody = await privy.walletApi.ethereum.signMessage({
									walletId,
									message: params.message,
								});
								break;
							case "eth_signTypedData_v4":
								responseBody = await privy.walletApi.ethereum.signTypedData({
									walletId,
									typedData: params.typed_data,
								});
								break;
							case "secp256k1_sign":
								responseBody = await privy.walletApi.ethereum.secp256k1Sign({
									walletId,
									hash: params.hash,
								});
								break;
							case "signMessage": // Solana
								responseBody = await privy.walletApi.solana.signMessage({
									walletId,
									message: params.message,
								});
								break;
							case "eth_sendTransaction":
								responseBody = await privy.walletApi.ethereum.sendTransaction({
									walletId,
									caip2: params.caip2,
									transaction: params.transaction,
								});
								break;
							case "eth_signTransaction":
								responseBody = await privy.walletApi.ethereum.signTransaction({
									walletId,
									transaction: params.transaction,
								});
								break;
							case "eth_sign7702Authorization":
								responseBody = await privy.walletApi.ethereum.sign7702Authorization({
									walletId,
									contract: params.contract,
									chainId: params.chain_id,
									nonce: params.nonce,
								});
								break;
							case "signAndSendTransaction": // Solana
								responseBody = await privy.walletApi.solana.signAndSendTransaction({
									walletId,
									caip2: params.caip2,
									transaction: params.transaction,
								});
								break;
							case "signTransaction": // Solana
								responseBody = await privy.walletApi.solana.signTransaction({
									walletId,
									transaction: params.transaction,
								});
								break;
							default:
								return new Response(JSON.stringify({ error: `Unsupported RPC method: ${method}` }), {
									headers: { "Content-Type": "application/json" },
									status: 400,
								});
						}

						return new Response(JSON.stringify({ method, data: responseBody }), {
							headers: { "Content-Type": "application/json" },
							status: 200,
						});

					} catch (error) {
						return new Response(JSON.stringify({ error: `Error processing RPC request: ${(error as Error).message}` }), {
							headers: { "Content-Type": "application/json" },
							status: 500,
						});
					}
				} else {
					return new Response("Method Not Allowed", { status: 405 });
				}
			} else {
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