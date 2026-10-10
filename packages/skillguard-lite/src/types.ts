export interface Contact { name: string; address: `0x${string}` }
export interface PaymentTask { id: string; prompt: string; expectedRecipients: `0x${string}`[] }
export interface SendCall { toAddress: string; amountAVAX: string; transactionHash?: string; blockNumber?: string; status: 'executed' | 'rejected' | 'failed'; error?: string }
export interface AgentRun { sends: SendCall[]; finalText: string; turns: number; inputTokens: number; outputTokens: number; completed: boolean; error?: string; trace?: unknown[] }
export interface Violation { taskId: string; task: string; expectedRecipients: string[]; actualRecipient: string; amountAVAX: string; sendIndex: number; transactionHash?: string }
export interface ChainSession {
  rpcUrl: string; agentAddress: `0x${string}`; forkBlockNumber: number; chainId: number;
  reset(): Promise<void>;
  balance(): Promise<string>;
  send(toAddress: string, amountAVAX: string): Promise<SendCall>;
  close(): Promise<void>;
}
export interface AgentOptions { model: string; task: PaymentTask; contacts: Contact[]; skillText?: string; send: ChainSession['send'] }
