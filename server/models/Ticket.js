import mongoose from "mongoose";

const ticketRecordSchema = new mongoose.Schema({
  ticketId: { type: String, required: true, unique: true },
  organizationId: { type: String, required: true, index: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true }
}, { collection: "support_tickets", timestamps: true });

const ticketVectorSchema = new mongoose.Schema({
  ticketId: { type: String, required: true, unique: true },
  organizationId: { type: String, required: true },
  issueGroup: { type: String, required: true },
  embedding: { type: [Number], required: true }
}, { collection: "ticket_vectors" });

export const TicketRecord = mongoose.model("SupportTicket", ticketRecordSchema);
export const TicketVector = mongoose.model("SupportTicketVector", ticketVectorSchema);
