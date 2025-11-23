#!/usr/bin/env tsx
/**
 * Parse Zendesk ticket information from Slack message
 */

interface ZendeskTicketInfo {
  ticket_id: string;
  ticket_url: string;
  subject: string;
  status: string | null;
  priority: string | null;
  requester: string | null;
  assignee: string | null;
  description: string | null;
  account: string | null;
}

function parseZendeskMessage(message: any): ZendeskTicketInfo | null {
  // Check if this is a Zendesk bot message
  const isZendesk = message.bot_profile?.name === 'Zendesk' || message.bot_id === 'B09UMQGC2PP';

  if (!isZendesk || !message.attachments || message.attachments.length === 0) {
    return null;
  }

  const attachment = message.attachments[0];

  // Extract from footer: <URL|*티켓 #2*> | 상태: 신규 | 우선 순위: 보통 | 계정: Momo
  const footer = attachment.footer || '';

  // Extract ticket URL and ID
  const urlMatch = footer.match(/<(https:\/\/[^|]+)\/agent\/tickets\/(\d+)\|/);
  const ticket_url = urlMatch ? urlMatch[1] + '/agent/tickets/' + urlMatch[2] : null;
  const ticket_id = urlMatch ? urlMatch[2] : null;

  // Extract status (Korean or English)
  const statusMatch =
    footer.match(/상태:\s*([^|]+)\s*\|/) || footer.match(/Status:\s*([^|]+)\s*\|/);
  const status = statusMatch ? statusMatch[1].trim() : null;

  // Extract priority from footer
  const priorityFooterMatch =
    footer.match(/우선\s*순위:\s*([^|]+)\s*\|/) || footer.match(/Priority:\s*([^|]+)\s*\|/);
  const priorityFooter = priorityFooterMatch ? priorityFooterMatch[1].trim() : null;

  // Extract account
  const accountMatch = footer.match(/계정:\s*(.+)$/) || footer.match(/Account:\s*(.+)$/);
  const account = accountMatch ? accountMatch[1].trim() : null;

  // Extract from fields
  const fieldValue = attachment.fields?.[0]?.value || '';

  // Extract subject from first line: <URL|*Subject*>
  const subjectMatch = fieldValue.match(/<[^|]+\|\*(.+?)\*>/);
  const subject = subjectMatch ? subjectMatch[1] : null;

  // Extract priority from field (more detailed)
  const priorityFieldMatch = fieldValue.match(
    /\*Priority\*:\s*[^\n]*?\s*(Normal|Low|High|Urgent)/i
  );
  const priorityField = priorityFieldMatch ? priorityFieldMatch[1] : null;
  const priority = priorityField || priorityFooter;

  // Extract requester
  const requesterMatch = fieldValue.match(/\*Requester\*:\s*(.+)/);
  const requester = requesterMatch ? requesterMatch[1].trim() : null;

  // Extract assignee
  const assigneeMatch = fieldValue.match(/\*Assignee\*:\s*(.+)/);
  const assignee = assigneeMatch ? assigneeMatch[1].trim() : null;

  // Extract description (everything after "Description:" to end)
  const descriptionMatch = fieldValue.match(/\*Description\*:\s*\n(.+)/s);
  const description = descriptionMatch ? descriptionMatch[1].trim() : null;

  if (!ticket_id || !ticket_url) {
    return null;
  }

  return {
    ticket_id,
    ticket_url,
    subject: subject || 'Unknown',
    status,
    priority,
    requester,
    assignee: assignee === '/' ? null : assignee,
    description,
    account,
  };
}

// Test with actual data
async function test() {
  const fs = await import('fs/promises');
  const path = await import('path');

  const messagesPath = path.join(process.cwd(), 'scripts/debug/output/slack-messages-bot.json');
  const messages = JSON.parse(await fs.readFile(messagesPath, 'utf-8'));

  console.log('🔍 Parsing Zendesk messages...\n');

  messages.forEach((msg: any, idx: number) => {
    const parsed = parseZendeskMessage(msg);

    if (parsed) {
      console.log(`✅ Message #${idx + 1}:`);
      console.log(`   Ticket ID: ${parsed.ticket_id}`);
      console.log(`   URL: ${parsed.ticket_url}`);
      console.log(`   Subject: ${parsed.subject}`);
      console.log(`   Status: ${parsed.status || 'N/A'}`);
      console.log(`   Priority: ${parsed.priority || 'N/A'}`);
      console.log(`   Requester: ${parsed.requester || 'N/A'}`);
      console.log(`   Assignee: ${parsed.assignee || 'Unassigned'}`);
      console.log(`   Description: ${parsed.description?.substring(0, 50) || 'N/A'}...`);
      console.log(`   Account: ${parsed.account || 'N/A'}`);
      console.log('');
    } else {
      console.log(`⏭️  Message #${idx + 1}: Not a Zendesk message\n`);
    }
  });

  // Save parsed results
  const parsedMessages = messages
    .map((msg: any) => parseZendeskMessage(msg))
    .filter((parsed: any) => parsed !== null);

  const outputPath = path.join(process.cwd(), 'scripts/debug/output/parsed-zendesk-tickets.json');
  await fs.writeFile(outputPath, JSON.stringify(parsedMessages, null, 2));

  console.log(`\n📄 Saved ${parsedMessages.length} parsed tickets: ${outputPath}\n`);

  // Validation summary
  console.log('✅ Validation Summary:\n');
  console.log(`   Total Zendesk messages: ${parsedMessages.length}`);
  console.log(`   Ticket IDs extracted: ${parsedMessages.filter((p: any) => p.ticket_id).length}`);
  console.log(`   URLs extracted: ${parsedMessages.filter((p: any) => p.ticket_url).length}`);
  console.log(`   Subjects extracted: ${parsedMessages.filter((p: any) => p.subject).length}`);
  console.log(`   Priorities extracted: ${parsedMessages.filter((p: any) => p.priority).length}`);
  console.log(`   Requesters extracted: ${parsedMessages.filter((p: any) => p.requester).length}`);
  console.log('');
}

test();

export { parseZendeskMessage };
