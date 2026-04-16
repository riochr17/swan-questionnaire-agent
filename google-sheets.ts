import {google} from 'googleapis';


// async function listMajors() {

//   const result = await sheets.spreadsheets.values.get({
//     spreadsheetId,
//     range: 'Sheet1!A1:E5',
//   });
//   const rows = result.data.values;
//   console.log(rows);
// }

export async function addNewRecord(auth: any, spreadsheet_id: string, sheet_name: string, record: string[]) {
  const sheets = google.sheets({version: 'v4', auth});
  await sheets.spreadsheets.values.append({
    spreadsheetId: spreadsheet_id,
    range: `${sheet_name}!A:Z`,
    valueInputOption: "RAW",
    requestBody: {
      values: [record],
    },
  });
}

export async function testRead(auth: any, spreadsheet_id: string, sheet_name: string) {
  const sheets = google.sheets({version: 'v4', auth});
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheet_id,
    range: `${sheet_name}!A1:A1`,
  });
  return result;
}

// async function main() {
//   await listMajors();
// }

// main().catch(console.error);
