require('dotenv').config();
import { AgentTool, OpenAILLM, startAgentCLI, startAgentServer, startAgentTelegram, startAgentWAHA, TerminationError, TerminationTimeout } from "@ssww.one/framework";
import {google} from 'googleapis';
import path from "path";
import { addNewRecord, testRead } from "./google-sheets";
import z from "zod";

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const CREDENTIALS_PATH = path.join(process.cwd(), 'google-sheets-services-account.json');
function extractSpreadsheetId(url: string): string | null {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

export async function agent(at: AgentTool) {
  let has_complete_questionnaire = false;
  const spreadsheet_id: string = extractSpreadsheetId(process.env.SPREADSHEET_URL || '') || '';
  const spreadsheet_sheet_name = process.env.SPREADSHEET_SHEET_NAME || 'Sheet1';
  let auth = null;
  try {
    auth = new google.auth.GoogleAuth({
      keyFile: CREDENTIALS_PATH,
      scopes: SCOPES,
    });
    await testRead(auth, spreadsheet_id, spreadsheet_sheet_name);
  } catch (err: any) {
    at.exit(`ERROR FAILED AUTHENTICATE SHEETS: ${err.message}`);
    return;
  }
  const name = process.env.NAME || 'Questionnaire Agent';
  await at.prepareKnowledge(`You are an agent and your name is ${name}.`);
  await at.prepareKnowledge(process.env.AGENT_BRIEF || 'No brief');
  await at.prepareKnowledge([
    'Questionnaire Format (must follow this)',
    process.env.QUESTIONNAIRE_FORMAT || 'This questionnaire format is: name, email, and comments',
    'Your job to gather data from user based on questionnaire format above in the correct order (order is matter), user can provide data unordered',
  ].join('\n'));
  await at.prepareKnowledge(`Current date and time: ${new Date().toISOString()}`);

  // Initial greetings
  at.print(await at.askLLM(
    [
      'Give short greetings to user based on given context',
      'Your greetings must be simple and related to questionnaire',
      'First, ask user to say magic word "start" to begin gathering questionnaire data and after user say the magic work you should tell what data they need to provide to complete the questionnaire',
      'Dont tell user its a magic word, translate the magic word to user-brief-language',
      'Always begin the questionnaire after the magic word',
      'Alaways confirm the data after user complete all required fields'
    ].join('\n')
  ), true);
  
  // Main loop
  try {
    while (true) {
      const instruction = await at.waitForUserInstruction();
      const has_complete_data: boolean = await at.askLLM(`Did user completed all required data for the questionnaire?`, z.boolean());
      console.log({ has_complete_data });
      if (!has_complete_questionnaire && has_complete_data) {
        const data: string[] = await at.askLLM(`Extract latest data provided by user with correct order as given format! Format must be in array of string, on optional fields give blank string`, z.array(z.string()));
        console.log({ data });
        await addNewRecord(auth, spreadsheet_id, spreadsheet_sheet_name, data);
        await at.streamLLM(
          `Now say thanks for the user and questionnaire has been close. After this session you are not allowed to receive other data and push user to refresh or reopen the page to start new session`,
          (s: string) => at.print(s)
        );
        at.exit(``);
        return;
      } else {
        await at.streamLLM(
          `User request: "${instruction}". Respond user request but keep push for gathering data.`,
          (s: string) => at.print(s)
        );
        at.print('', true);
      }
    }
  } catch (err: any) {
    if (err instanceof TerminationError) {
      at.exit(`Conversation ended`);
    }
    else if (err instanceof TerminationTimeout) {
      at.exit(`Conversation ended`);
    } else {
      at.print(err?.message ?? '5XX: Agent cannot process this request', true);
    }
  }
}

startAgentServer(agent, {
  llm: new OpenAILLM(),
  port: +(process.env.PORT || 9811),
  timeout: 120 * 1000
});
startAgentTelegram(agent, {
  llm: new OpenAILLM()
});
startAgentWAHA(agent, {
  llm: new OpenAILLM()
});
// startAgentCLI(agent, {
//   llm: new OpenAILLM()
// });
