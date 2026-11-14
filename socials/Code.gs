/**
 * ============================================================================
 * BEVERLEY ROUND TABLE (BRT) — ANNUAL SOCIALS PLANNER BACKEND
 * Google Apps Script (Bound to Google Sheet)
 * ============================================================================
 *
 * DATABASE STRUCTURE (Auto-created via setupSocialsDatabase() or menu):
 *   1. "Members"  — Add/remove member names in Column B; quotas auto-sync.
 *   2. "Socials"  — 1st Wednesday (PAID) & 3rd Wednesday (FREE / Sub-£20) slots.
 *                   December is excluded for Beverley Santa Sleigh season.
 *   3. "Settings" — Club defaults, start month & WhatsApp link.
 *                    (Secrets live in Apps Script Script Properties, NOT in cells!)
 *
 * SETUP INSTRUCTIONS:
 *   1. Create a blank Google Sheet (e.g. "BRT Annual Socials Database").
 *   2. Open Extensions -> Apps Script, paste this entire file into Code.gs, save.
 *   3. Reload the Google Sheet -> click "🍻 BRT Socials Admin -> 1. Initialise".
 *   4. Add your member names into the "Members" tab (Column B).
 *   5. Click "🍻 BRT Socials Admin -> 5. Set Gemini API Key" (saves to Script Properties)
 *      and "6. Set Table PIN / Admin PIN" (stored in Script Properties as TABLE_PIN).
 *   6. Deploy -> New deployment -> Web app:
 *        - Execute as: Me
 *        - Who has access: Anyone
 *   7. Copy the Web App URL ending in /exec into socials.html / router/worker.js.
 * ============================================================================
 */

var SHEET_NAMES = {
  MEMBERS: 'Members',
  SOCIALS: 'Socials',
  SETTINGS: 'Settings'
};

var MEMBERS_HEADERS = [
  'MemberID',
  'Name',
  'Role',
  'PaidCount',
  'FreeCount',
  'PaidSocialTitle',
  'FreeSocialTitle',
  'QuotaStatus',
  'Active',
  'ProgrammeOfficer'
];

var SOCIALS_HEADERS = [
  'SlotID',
  'DateISO',
  'DisplayDate',
  'MonthYear',
  'WednesdayOrdinal',
  'SocialType',
  'BudgetRule',
  'Status',
  'OrganizerName',
  'CoOrganizerName',
  'Title',
  'Description',
  'Location',
  'StartTime',
  'EndTime',
  'CostPerPerson',
  'AccessoriesNeeded',
  'ProspectiveFriendly',
  'ImgUrl',
  'UpdatedAt'
];

var SETTINGS_HEADERS = ['Key', 'Value', 'Notes'];

var DEFAULT_SETTINGS = [
  ['SECURITY_STORAGE', 'Script Properties (Private)', 'Use menu "🍻 BRT Socials Admin -> 🔐 Set Gemini Key / 🔒 Set Table PIN" — never paste secrets into cells'],
  ['GEMINI_MODEL', 'AUTO', 'AUTO = dynamically picks the latest free-tier Gemini Flash model (or enter a specific model name)'],
  ['START_YEAR_MONTH', '2027-02', 'YYYY-MM start month (defaults to 2027-02; dynamically rolls 12 months ahead as time passes).'],
  ['MONTHS_AHEAD', '12', 'Calendar months to generate from start month (December excluded for Santa Sleigh)'],
  ['CLUB_NAME', 'Beverley Round Table', 'Displayed in AI prompts and public event feed'],
  ['CLUB_AREA', 'Beverley & East Yorkshire (Hull, Westwood, Molescroft, Walkington)', 'Local context for Gemini suggestions'],
  ['DEFAULT_START_TIME', '19:30', 'Default start time for Wednesday socials'],
  ['DEFAULT_END_TIME', '22:00', 'Default finish time for Wednesday socials'],
  ['WHATSAPP_INVITE_URL', 'https://chat.whatsapp.com/CjoA2cYnR5H9D9N8w1WeuR', 'Prospective & member WhatsApp group link'],
  ['AUTO_RELEASE_ON_MEMBER_DELETE', 'TRUE', 'If TRUE, removing a member releases their future OPEN/planned slots']
];

// ============================================================================
// GOOGLE SHEETS CUSTOM MENU & TRIGGERS
// ============================================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🍻 BRT Socials Admin')
    .addItem('1. Initialise / Repair Sheet Structure', 'setupSocialsDatabase')
    .addItem('2. Generate Next 12 Months (1st & 3rd Weds)', 'menuGenerateCalendar')
    .addItem('3. Sync Members & Recalculate Quotas', 'menuSyncAll')
    .addSeparator()
    .addItem('4. Test Gemini AI Connection', 'menuTestGemini')
    .addItem('5. 🔐 Set Gemini API Key (Script Properties)', 'menuSetGeminiKey')
    .addItem('6. 🔒 Set Table PIN / Admin PIN (Script Properties)', 'menuSetPins')
    .addToUi();
}

function menuGenerateCalendar() {
  ensureSetup_();
  var added = ensureCalendarSlots_(true);
  syncMembersAndQuotas_();
  SpreadsheetApp.getUi().alert('Calendar synced! Added ' + added + ' new 1st/3rd Wednesday slot(s) (December excluded for Santa Sleigh).');
}

function menuSyncAll() {
  ensureSetup_();
  var res = syncMembersAndQuotas_();
  SpreadsheetApp.getUi().alert(
    'Synced ' + res.memberCount + ' active members.\n' +
    'Released ' + res.releasedSlots + ' orphaned future slot(s).'
  );
}

function menuTestGemini() {
  ensureSetup_();
  try {
    var result = callGeminiAi_({
      mode: 'ideas',
      socialType: 'FREE',
      monthYear: 'Next Month',
      displayDate: '3rd Wednesday',
      userPrompt: 'Quick test for a fun free social in Beverley'
    });
    SpreadsheetApp.getUi().alert('Gemini connection works! (Active model: ' + result.model + ')\nSample idea: ' + result.suggestions[0].title);
  } catch (err) {
    SpreadsheetApp.getUi().alert('Gemini test failed: ' + (err && err.message ? err.message : err));
  }
}

function menuSetGeminiKey() {
  var ui = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();
  var existing = props.getProperty('GEMINI_API_KEY') || '';
  var hint = existing ? 'A key is currently saved (starts with ' + existing.slice(0, 6) + '...). Paste a new key to replace it, or type CLEAR to remove it:' : 'Paste your Google AI Studio Gemini API key below. It is saved privately in Script Properties (never in spreadsheet cells):';
  var res = ui.prompt('🔐 Set Gemini API Key', hint, ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;

  var val = String(res.getResponseText() || '').trim();
  if (!val) {
    ui.alert('No changes made (empty input).');
    return;
  }
  if (val.toUpperCase() === 'CLEAR') {
    props.deleteProperty('GEMINI_API_KEY');
    ui.alert('Cleared GEMINI_API_KEY from Script Properties.');
    return;
  }
  props.setProperty('GEMINI_API_KEY', val);
  ui.alert('Saved GEMINI_API_KEY securely into Script Properties!');
}

function menuSetPins() {
  var ui = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();
  var curTablePin = getTablePin_(getSettingsMap_());
  var curAdminPin = getAdminPin_(getSettingsMap_());

  var resTable = ui.prompt(
    '🔒 Step 1 of 2: Set Table Member PIN',
    'Tablers enter this PIN once on the website to claim/edit socials or use Gemini AI.\nCurrent Table PIN: ' + (curTablePin ? '(set in Script Properties)' : '(not set yet)') + '. Enter PIN (or Cancel to abort):',
    ui.ButtonSet.OK_CANCEL
  );
  if (resTable.getSelectedButton() !== ui.Button.OK) return;

  var nextTablePin = String(resTable.getResponseText() || '').trim() || curTablePin;
  if (!nextTablePin) {
    ui.alert('Please enter a non-empty Table PIN.');
    return;
  }
  props.setProperty('TABLE_PIN', nextTablePin);

  var resAdmin = ui.prompt(
    '🛡️ Step 2 of 2: Optional Admin / Programme Officer PIN',
    'Optional stricter PIN for Add/Delete Members & Programme Officer changes.\nLeave blank (click OK with empty box) or type NONE so the Table PIN handles everything.\nCurrent Admin PIN: ' + (curAdminPin ? '(separate PIN set)' : '(none — uses Table PIN)'),
    ui.ButtonSet.OK_CANCEL
  );
  if (resAdmin.getSelectedButton() === ui.Button.OK) {
    var nextAdminPin = String(resAdmin.getResponseText() || '').trim();
    if (!nextAdminPin || nextAdminPin.toUpperCase() === 'NONE' || nextAdminPin.toUpperCase() === 'CLEAR') {
      props.deleteProperty('ADMIN_PIN');
      curAdminPin = '';
    } else {
      props.setProperty('ADMIN_PIN', nextAdminPin);
      curAdminPin = nextAdminPin;
    }
  }

  ui.alert(
    'Security PINs updated in Script Properties!\n\n' +
    'Table PIN (TABLE_PIN): Saved securely in Script Properties\n' +
    'Member/Programme Officer Admin PIN: ' + (curAdminPin ? 'Separate PIN set' : 'Same as Table PIN')
  );
}

/**
 * Installable-compatible change handler (if user binds an On change trigger).
 */
function onChange() {
  ensureSetup_();
  syncMembersAndQuotas_();
}

/**
 * Simple trigger: runs automatically when a user edits cells directly in Google Sheets.
 * - Typing a name in Members!B auto-generates MemberID, Active=TRUE, and quota columns.
 * - Clearing a name or setting Active=FALSE releases future slots assigned to that member.
 * - Renaming a member in Members!B updates OrganizerName/CoOrganizerName on their slots.
 */
function onEdit(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  var name = sheet.getName();

  if (name === SHEET_NAMES.MEMBERS) {
    var col = e.range.getColumn();
    var row = e.range.getRow();
    // Handle direct rename in Column B (single cell edit) so existing slots follow the rename
    if (col === 2 && row >= 2 && e.range.getNumRows() === 1 && e.oldValue && e.value) {
      var oldName = String(e.oldValue).trim();
      var newName = String(e.value).trim();
      if (oldName && newName && oldName.toLowerCase() !== newName.toLowerCase()) {
        renameOrganizerInSocials_(oldName, newName);
      }
    }
    // Handle direct toggle in Column J (ProgrammeOfficer flag) so Role stays in sync
    if (col === 10 && row >= 2 && e.range.getNumRows() === 1) {
      var jVal = (typeof e.value !== 'undefined') ? e.value : e.range.getValue();
      var valUpper = String(jVal === null || typeof jVal === 'undefined' ? '' : jVal).trim().toUpperCase();
      var roleCell = sheet.getRange(row, 3);
      var curRole = String(roleCell.getValue() || '').trim();
      if (valUpper === 'FALSE' || valUpper === 'NO' || valUpper === '0' || valUpper === '') {
        if (isProgrammeOfficerRow_(curRole, false)) {
          roleCell.setValue('Member');
        }
      } else if (valUpper === 'TRUE' || valUpper === 'YES' || valUpper === '1') {
        if (!curRole || curRole === 'Member') {
          roleCell.setValue('Programme Officer');
        }
      }
    }
    syncMembersAndQuotas_();
  } else if (name === SHEET_NAMES.SOCIALS) {
    syncMembersAndQuotas_();
  }
}

/**
 * Run once from the menu (or Apps Script editor) to create & style all 3 tabs.
 */
function setupSocialsDatabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Settings tab
  var settingsSheet = getOrCreateSheet_(ss, SHEET_NAMES.SETTINGS);
  settingsSheet.getRange('B:B').setNumberFormat('@');
  ensureHeaders_(settingsSheet, SETTINGS_HEADERS);
  seedDefaultSettings_(settingsSheet);
  styleSheetHeader_(settingsSheet, SETTINGS_HEADERS.length, '#1D1D1A', '#FBAF33');
  settingsSheet.setColumnWidth(1, 240);
  settingsSheet.setColumnWidth(2, 340);
  settingsSheet.setColumnWidth(3, 420);

  // 2. Members tab
  var membersSheet = getOrCreateSheet_(ss, SHEET_NAMES.MEMBERS);
  ensureHeaders_(membersSheet, MEMBERS_HEADERS);
  styleSheetHeader_(membersSheet, MEMBERS_HEADERS.length, '#1D1D1A', '#FBAF33');
  membersSheet.setColumnWidth(1, 140);
  membersSheet.setColumnWidth(2, 200);
  membersSheet.setColumnWidth(3, 140);
  membersSheet.setColumnWidth(4, 95);
  membersSheet.setColumnWidth(5, 95);
  membersSheet.setColumnWidth(6, 240);
  membersSheet.setColumnWidth(7, 240);
  membersSheet.setColumnWidth(8, 230);
  membersSheet.setColumnWidth(9, 80);
  membersSheet.setColumnWidth(10, 150);

  membersSheet.getRange('B1').setNote(
    'Type member names directly in Column B below (one per row).\n' +
    'MemberID, quotas, and status auto-fill.\n' +
    'Deleting a name or setting Active=FALSE automatically releases their future slots.'
  );
  membersSheet.getRange('J1').setNote(
    'Set TRUE for one or more Programme Officers.\n' +
    'Programme Officers coordinate the calendar so everything runs to plan and still contribute their own 1 Paid + 1 Free social.'
  );

  // 3. Socials tab
  var socialsSheet = getOrCreateSheet_(ss, SHEET_NAMES.SOCIALS);
  socialsSheet.getRange('A:D').setNumberFormat('@');
  socialsSheet.getRange('N:O').setNumberFormat('@');
  ensureHeaders_(socialsSheet, SOCIALS_HEADERS);
  styleSheetHeader_(socialsSheet, SOCIALS_HEADERS.length, '#1D1D1A', '#FBAF33');
  socialsSheet.setColumnWidth(1, 110); // SlotID
  socialsSheet.setColumnWidth(2, 105); // DateISO
  socialsSheet.setColumnWidth(3, 145); // DisplayDate
  socialsSheet.setColumnWidth(4, 130); // MonthYear
  socialsSheet.setColumnWidth(5, 125); // WednesdayOrdinal
  socialsSheet.setColumnWidth(6, 95);  // SocialType
  socialsSheet.setColumnWidth(7, 240); // BudgetRule
  socialsSheet.setColumnWidth(8, 105); // Status
  socialsSheet.setColumnWidth(9, 160); // OrganizerName
  socialsSheet.setColumnWidth(10, 150); // CoOrganizerName
  socialsSheet.setColumnWidth(11, 220); // Title
  socialsSheet.setColumnWidth(12, 320); // Description
  socialsSheet.setColumnWidth(13, 190); // Location
  socialsSheet.setColumnWidth(14, 90);  // StartTime
  socialsSheet.setColumnWidth(15, 90);  // EndTime
  socialsSheet.setColumnWidth(16, 135); // CostPerPerson
  socialsSheet.setColumnWidth(17, 220); // AccessoriesNeeded
  socialsSheet.setColumnWidth(18, 130); // ProspectiveFriendly
  socialsSheet.setColumnWidth(19, 200); // ImgUrl
  socialsSheet.setColumnWidth(20, 175); // UpdatedAt

  socialsSheet.getRange('A1').setNote(
    '1st Wednesday = PAID commercial activity.\n' +
    '3rd Wednesday = FREE / sub-£20 creative social.\n' +
    'December is automatically skipped for Beverley Santa Sleigh.'
  );

  // Generate calendar & apply validation/formatting
  ensureCalendarSlots_(true);
  applySheetConditionalFormatting_(socialsSheet, membersSheet);
  syncMembersAndQuotas_();
}

// ============================================================================
// WEB APP HTTP ENTRYPOINTS (doGet / doPost)
// ============================================================================

function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};

  // Compatibility with site/BRT.html (?type=upcoming)
  if (params.type === 'upcoming') {
    return jsonRawResponse_(getUpcomingEventsCompat_());
  }

  var action = (params.action || 'init').toLowerCase();

  try {
    if (action !== 'ai-assist' && action !== 'verify-pin') {
      ensureSetup_();
    }

    if (action === 'init' || action === 'state' || action === 'list' || action === 'events') {
      return jsonOk_(buildFullState_());
    }

    if (action === 'verify-pin') {
      requirePin_(params, params.level || 'member');
      return jsonOk_({ valid: true });
    }

    if (action === 'save-social') {
      requirePin_(params, 'member');
      return withScriptLock_(function () {
        var result = saveSocialSlot_(params);
        return jsonOk_(result);
      });
    }

    if (action === 'delete-social') {
      requirePin_(params, 'member');
      return withScriptLock_(function () {
        var result = deleteSocialSlot_(params);
        return jsonOk_(result);
      });
    }

    if (action === 'add-member') {
      requirePin_(params, 'admin');
      return withScriptLock_(function () {
        var result = addMemberRecord_(params);
        return jsonOk_(result);
      });
    }

    if (action === 'delete-member') {
      requirePin_(params, 'admin');
      return withScriptLock_(function () {
        var result = deleteMemberRecord_(params);
        return jsonOk_(result);
      });
    }

    if (action === 'toggle-programme-officer') {
      requirePin_(params, 'admin');
      return withScriptLock_(function () {
        var result = toggleProgrammeOfficer_(params);
        return jsonOk_(result);
      });
    }

    if (action === 'ai-assist') {
      requirePin_(params, 'member');
      var aiData = callGeminiAi_(params);
      return jsonOk_(aiData);
    }

    return jsonError_('Unknown action: ' + action);
  } catch (err) {
    return jsonError_(err && err.message ? err.message : String(err), err && err.code);
  }
}

function doPost(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var body = {};

  if (e && e.postData && e.postData.contents) {
    try {
      body = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return jsonError_('Invalid JSON payload: ' + parseErr.message);
    }
  }

  var payload = mergeObjects_(params, body);
  var action = String(payload.action || 'init').toLowerCase();

  try {
    if (action !== 'ai-assist' && action !== 'verify-pin') {
      ensureSetup_();
    }

    if (action === 'init' || action === 'state' || action === 'list') {
      return jsonOk_(buildFullState_());
    }

    if (action === 'verify-pin') {
      requirePin_(payload, payload.level || 'member');
      return jsonOk_({ valid: true });
    }

    if (action === 'save-social') {
      requirePin_(payload, 'member');
      return withScriptLock_(function () {
        return jsonOk_(saveSocialSlot_(payload));
      });
    }

    if (action === 'delete-social') {
      requirePin_(payload, 'member');
      return withScriptLock_(function () {
        return jsonOk_(deleteSocialSlot_(payload));
      });
    }

    if (action === 'add-member') {
      requirePin_(payload, 'admin');
      return withScriptLock_(function () {
        return jsonOk_(addMemberRecord_(payload));
      });
    }

    if (action === 'delete-member') {
      requirePin_(payload, 'admin');
      return withScriptLock_(function () {
        return jsonOk_(deleteMemberRecord_(payload));
      });
    }

    if (action === 'toggle-programme-officer') {
      requirePin_(payload, 'admin');
      return withScriptLock_(function () {
        return jsonOk_(toggleProgrammeOfficer_(payload));
      });
    }

    if (action === 'ai-assist') {
      requirePin_(payload, 'member');
      return jsonOk_(callGeminiAi_(payload));
    }

    return jsonError_('Unknown POST action: ' + action);
  } catch (err) {
    return jsonError_(err && err.message ? err.message : String(err), err && err.code);
  }
}

// ============================================================================
// CORE DATA & CALENDAR LOGIC
// ============================================================================

function ensureSetup_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(SHEET_NAMES.MEMBERS) ||
      !ss.getSheetByName(SHEET_NAMES.SOCIALS) ||
      !ss.getSheetByName(SHEET_NAMES.SETTINGS)) {
    setupSocialsDatabase();
  }
}

function getActiveHorizonFloorIso_(sheet, settings) {
  var tz = Session.getScriptTimeZone() || 'Europe/London';
  var currentYm = Utilities.formatDate(new Date(), tz, 'yyyy-MM');
  var startYm = resolveEffectiveStartMonth_(sheet, settings);
  var anchorYm = currentYm > startYm ? currentYm : startYm;
  return {
    startYm: startYm,
    currentYm: currentYm,
    anchorYm: anchorYm,
    floorIso: anchorYm + '-01'
  };
}

function buildFullState_() {
  ensureCalendarSlots_(false);
  syncMembersAndQuotas_();

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var socialsSheet = ss.getSheetByName(SHEET_NAMES.SOCIALS);
  var settings = getSettingsMap_();
  var horizon = getActiveHorizonFloorIso_(socialsSheet, settings);
  var members = readMembers_();
  var socials = readSocials_();

  var activeMembers = members.filter(function (m) { return m.active; });
  var planningMembers = activeMembers;
  var programmeOfficers = activeMembers.filter(function (m) { return m.isProgrammeOfficer; });
  var windowSocials = socials.filter(function (s) { return s.dateISO >= horizon.floorIso; });
  var totalSlots = windowSocials.length;
  var paidSlots = windowSocials.filter(function (s) { return s.socialType === 'PAID'; });
  var freeSlots = windowSocials.filter(function (s) { return s.socialType === 'FREE'; });
  var claimedSlots = windowSocials.filter(function (s) { return s.status !== 'OPEN'; });
  var paidClaimed = paidSlots.filter(function (s) { return s.status !== 'OPEN'; });
  var freeClaimed = freeSlots.filter(function (s) { return s.status !== 'OPEN'; });
  var completedMembers = planningMembers.filter(function (m) {
    return m.paidCount >= 1 && m.freeCount >= 1;
  });

  var tablePin = getTablePin_(settings);
  var adminPin = getAdminPin_(settings);

  return {
    clubName: settings.CLUB_NAME || 'Beverley Round Table',
    whatsappUrl: settings.WHATSAPP_INVITE_URL || 'https://chat.whatsapp.com/CjoA2cYnR5H9D9N8w1WeuR',
    hasGeminiKey: Boolean(getGeminiApiKey_(settings)),
    pinRequired: true,
    hasSeparateAdminPin: Boolean(adminPin && adminPin !== tablePin),
    defaultStartTime: settings.DEFAULT_START_TIME || '19:30',
    defaultEndTime: settings.DEFAULT_END_TIME || '22:00',
    members: activeMembers,
    socials: socials,
    stats: {
      totalSlots: totalSlots,
      claimedSlots: claimedSlots.length,
      openSlots: totalSlots - claimedSlots.length,
      paidTotal: paidSlots.length,
      paidClaimed: paidClaimed.length,
      freeTotal: freeSlots.length,
      freeClaimed: freeClaimed.length,
      activeMembersCount: planningMembers.length,
      completedQuotaMembers: completedMembers.length,
      totalRosterCount: activeMembers.length,
      programmeOfficersCount: programmeOfficers.length
    },
    generatedAt: new Date().toISOString()
  };
}

/**
 * Normalizes existing Socials rows to YYYY-MM-DD text keys, removes duplicate
 * rows caused by Google Sheets date-coercion, and prunes unclaimed pre-start OPEN rows.
 */
function dedupeAndNormalizeSocialsSheet_(sheet, effectiveStartYm) {
  sheet.getRange('A:D').setNumberFormat('@');
  sheet.getRange('N:O').setNumberFormat('@');
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var numRows = lastRow - 1;
  var rows = sheet.getRange(2, 1, numRows, SOCIALS_HEADERS.length).getValues();
  var floorIso = effectiveStartYm + '-01';
  var byIso = {};
  var order = [];
  var changed = false;
  var isDateObj = function (val) { return Object.prototype.toString.call(val) === '[object Date]'; };

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var rawA = String(r[0] || '').trim();
    var rawB = String(r[1] || '').trim();
    var iso = formatCellDateISO_(r[1]) || formatCellDateISO_(r[0]);
    if (!iso) {
      changed = true;
      continue;
    }

    var status = String(r[7] || 'OPEN').toUpperCase();
    if (iso < floorIso && status === 'OPEN') {
      changed = true;
      continue;
    }

    var cleanDisplay = formatDisplayDateFromIso_(iso);
    var cleanMonth = formatMonthYearFromIso_(iso);
    var cleanStart = formatCellTime_(r[13]) || '19:30';
    var cleanEnd = formatCellTime_(r[14]) || '22:00';

    if (
      rawA !== iso || rawB !== iso ||
      isDateObj(r[0]) || isDateObj(r[1]) ||
      (cleanDisplay && (isDateObj(r[2]) || String(r[2] || '').trim() !== cleanDisplay)) ||
      (cleanMonth && (isDateObj(r[3]) || String(r[3] || '').trim() !== cleanMonth)) ||
      isDateObj(r[13]) || String(r[13] || '').trim() !== cleanStart ||
      isDateObj(r[14]) || String(r[14] || '').trim() !== cleanEnd
    ) {
      r[0] = iso;
      r[1] = iso;
      if (cleanDisplay) r[2] = cleanDisplay;
      if (cleanMonth) r[3] = cleanMonth;
      r[13] = cleanStart;
      r[14] = cleanEnd;
      changed = true;
    }

    if (!byIso[iso]) {
      byIso[iso] = r;
      order.push(iso);
    } else {
      changed = true;
      var curStatus = String(byIso[iso][7] || 'OPEN').toUpperCase();
      if (curStatus === 'OPEN' && status !== 'OPEN') {
        byIso[iso] = r;
      }
    }
  }

  if (!changed) return;

  order.sort();
  var cleaned = order.map(function (k) { return byIso[k]; });
  sheet.getRange(2, 1, numRows, SOCIALS_HEADERS.length).clearContent();
  if (cleaned.length > 0) {
    sheet.getRange('A:D').setNumberFormat('@');
    sheet.getRange('N:O').setNumberFormat('@');
    sheet.getRange(2, 1, cleaned.length, SOCIALS_HEADERS.length).setValues(cleaned);
  }
}

function resolveEffectiveStartMonth_(sheet, settings) {
  var configuredYm = formatCellYearMonth_(settings.START_YEAR_MONTH);
  if (!configuredYm) return '2027-02';

  // Auto-upgrade legacy initial default ('2026-11') when pre-2027-02 slots are still OPEN
  if (configuredYm === '2026-11' && sheet && sheet.getLastRow() >= 2) {
    var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 9).getValues();
    var hasPreFebClaimed = false;
    for (var i = 0; i < rows.length; i++) {
      var iso = formatCellDateISO_(rows[i][1]) || formatCellDateISO_(rows[i][0]);
      var status = String(rows[i][7] || 'OPEN').toUpperCase();
      if (iso && iso < '2027-02-01' && status !== 'OPEN') {
        hasPreFebClaimed = true;
        break;
      }
    }
    if (!hasPreFebClaimed) return '2027-02';
  }
  return configuredYm;
}

function buildSlotRowFromDate_(dateObj, y, m0, ordinal, socialType, budgetRule, defaultStart, defaultEnd) {
  var monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  var shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var dayNum = dateObj.getUTCDate();
  var iso = y + '-' + pad2_(m0 + 1) + '-' + pad2_(dayNum);
  var displayDate = 'Wed ' + dayNum + ' ' + shortMonths[m0] + ' ' + y;
  var monthYear = monthNames[m0] + ' ' + y;

  return [
    iso,
    iso,
    displayDate,
    monthYear,
    ordinal,
    socialType,
    budgetRule,
    'OPEN',
    '',
    '',
    '',
    '',
    '',
    defaultStart,
    defaultEnd,
    socialType === 'FREE' ? 'Free / Sub-£20 kitty' : '',
    '',
    true,
    '',
    ''
  ];
}

/**
 * Generates 1st Wednesday (PAID) and 3rd Wednesday (FREE / Sub-£20) slots
 * starting from START_YEAR_MONTH (default 2027-02) dynamically rolling MONTHS_AHEAD
 * past max(startMonth, currentMonth) with December excluded for Santa Sleigh.
 * Never overwrites already-existing rows.
 */
function ensureCalendarSlots_(forceSort) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES.SOCIALS);
  var settings = getSettingsMap_();

  var horizon = getActiveHorizonFloorIso_(sheet, settings);
  dedupeAndNormalizeSocialsSheet_(sheet, horizon.anchorYm);

  var anchorParts = horizon.anchorYm.split('-');
  var anchorYear = parseInt(anchorParts[0], 10);
  var anchorMonth0 = parseInt(anchorParts[1], 10) - 1;

  var monthsAhead = Math.max(1, Math.min(24, parseInt(settings.MONTHS_AHEAD || '12', 10) || 12));
  var defaultStart = settings.DEFAULT_START_TIME || '19:30';
  var defaultEnd = settings.DEFAULT_END_TIME || '22:00';

  var existingIds = {};
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var existingVals = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    for (var i = 0; i < existingVals.length; i++) {
      var id = formatCellDateISO_(existingVals[i][1]) || formatCellDateISO_(existingVals[i][0]);
      if (id) existingIds[id] = true;
    }
  }

  var rowsToAppend = [];

  for (var mOffset = 0; mOffset < monthsAhead; mOffset++) {
    var targetDate = new Date(Date.UTC(anchorYear, anchorMonth0 + mOffset, 1));
    var y = targetDate.getUTCFullYear();
    var m0 = targetDate.getUTCMonth(); // 0..11

    // Exclude December (Beverley Santa Sleigh season)
    if (m0 === 11) continue;

    var wednesdays = getWednesdaysInMonth_(y, m0);
    // 1st Wednesday = index 0 (PAID), 3rd Wednesday = index 2 (FREE / Sub-£20)
    var targets = [
      {
        dateObj: wednesdays[0],
        ordinal: '1st Wednesday',
        type: 'PAID',
        rule: 'Commercial / Paid Activity'
      },
      {
        dateObj: wednesdays[2],
        ordinal: '3rd Wednesday',
        type: 'FREE',
        rule: 'Creative Free / Sub-£20 Group Accessories'
      }
    ];

    for (var t = 0; t < targets.length; t++) {
      var item = targets[t];
      if (!item.dateObj) continue;
      var dayNum = item.dateObj.getUTCDate();
      var iso = y + '-' + pad2_(m0 + 1) + '-' + pad2_(dayNum);
      if (existingIds[iso]) continue;

      rowsToAppend.push(
        buildSlotRowFromDate_(item.dateObj, y, m0, item.ordinal, item.type, item.rule, defaultStart, defaultEnd)
      );
      existingIds[iso] = true;
    }
  }

  if (rowsToAppend.length > 0) {
    sheet.getRange('A:D').setNumberFormat('@');
    sheet.getRange('N:O').setNumberFormat('@');
    sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, SOCIALS_HEADERS.length)
      .setValues(rowsToAppend);
  }

  if ((rowsToAppend.length > 0 || forceSort) && sheet.getLastRow() >= 3) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, SOCIALS_HEADERS.length)
      .sort({ column: 2, ascending: true });
  }

  return rowsToAppend.length;
}

/**
 * Saves or updates a social slot and syncs member quotas.
 */
function saveSocialSlot_(payload) {
  var slotId = String(payload.slotId || payload.SlotID || payload.dateISO || '').trim();
  if (!slotId) {
    var err = new Error('Missing slotId / date.');
    err.code = 'MISSING_SLOT';
    throw err;
  }

  var organizerName = String(payload.organizerName || '').trim();
  var title = String(payload.title || '').trim();
  if (!organizerName) {
    var orgErr = new Error('Please choose who is organising this social.');
    orgErr.code = 'MISSING_ORGANIZER';
    throw orgErr;
  }
  if (!title) {
    var titleErr = new Error('Please give this social a title.');
    titleErr.code = 'MISSING_TITLE';
    throw titleErr;
  }

  // Ensure the organizer exists in Members (auto-add if requested or typed new)
  ensureMemberExists_(organizerName);
  var coOrganizer = String(payload.coOrganizerName || '').trim();
  if (coOrganizer && coOrganizer.toLowerCase() === organizerName.toLowerCase()) {
    coOrganizer = '';
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES.SOCIALS);
  var targetIso = formatCellDateISO_(payload.dateISO) || formatCellDateISO_(slotId);
  var rowIndex = findRowByFirstCol_(sheet, slotId);
  if (rowIndex === -1 && targetIso && targetIso !== slotId) {
    rowIndex = findRowByFirstCol_(sheet, targetIso);
  }

  if (rowIndex === -1 && /^\d{4}-\d{2}-\d{2}$/.test(targetIso)) {
    var parts = targetIso.split('-');
    var y = parseInt(parts[0], 10);
    var m0 = parseInt(parts[1], 10) - 1;
    var weds = getWednesdaysInMonth_(y, m0);
    var settings = getSettingsMap_();
    var defStart = settings.DEFAULT_START_TIME || '19:30';
    var defEnd = settings.DEFAULT_END_TIME || '22:00';
    var matchSlot = null;
    if (weds[0] && (y + '-' + pad2_(m0 + 1) + '-' + pad2_(weds[0].getUTCDate())) === targetIso) {
      matchSlot = { d: weds[0], ord: '1st Wednesday', type: 'PAID', rule: 'Commercial / Paid Activity' };
    } else if (weds[2] && (y + '-' + pad2_(m0 + 1) + '-' + pad2_(weds[2].getUTCDate())) === targetIso) {
      matchSlot = { d: weds[2], ord: '3rd Wednesday', type: 'FREE', rule: 'Creative Free / Sub-£20 Group Accessories' };
    }
    if (matchSlot) {
      sheet.getRange('A:D').setNumberFormat('@');
      sheet.getRange('N:O').setNumberFormat('@');
      var newRow = buildSlotRowFromDate_(matchSlot.d, y, m0, matchSlot.ord, matchSlot.type, matchSlot.rule, defStart, defEnd);
      sheet.getRange(sheet.getLastRow() + 1, 1, 1, SOCIALS_HEADERS.length).setValues([newRow]);
      rowIndex = sheet.getLastRow();
    }
  }

  if (rowIndex === -1) {
    var notFoundErr = new Error('Social slot "' + slotId + '" not found in sheet.');
    notFoundErr.code = 'SLOT_NOT_FOUND';
    throw notFoundErr;
  }

  var rowVals = sheet.getRange(rowIndex, 1, 1, SOCIALS_HEADERS.length).getValues()[0];
  var currentStatus = String(rowVals[7] || 'OPEN').toUpperCase();
  var currentOrg = String(rowVals[8] || '').trim();
  var expectedOrg = String(payload.expectedCurrentOrganizer || '').trim();
  var allowOverwrite = String(payload.allowOverwrite || '').toLowerCase() === 'true' || payload.allowOverwrite === true;

  if (currentStatus !== 'OPEN' && currentOrg && !allowOverwrite) {
    if (!expectedOrg || currentOrg.toLowerCase() !== expectedOrg.toLowerCase()) {
      // Allow editing if the same organizer is saving their own slot
      if (currentOrg.toLowerCase() !== organizerName.toLowerCase()) {
        var conflictErr = new Error('This Wednesday was already claimed by ' + currentOrg + '. Refresh or edit their slot directly.');
        conflictErr.code = 'SLOT_CONFLICT';
        throw conflictErr;
      }
    }
  }

  var nextStatus = String(payload.status || 'CONFIRMED').toUpperCase();
  if (nextStatus !== 'CONFIRMED' && nextStatus !== 'IDEA') {
    nextStatus = 'CONFIRMED';
  }

  var prospective = payload.prospectiveFriendly === true ||
    String(payload.prospectiveFriendly).toLowerCase() === 'true';

  var nowIso = new Date().toISOString();
  var cleanIso = formatCellDateISO_(rowVals[1]) || formatCellDateISO_(rowVals[0]) || targetIso;
  if (cleanIso) {
    rowVals[0] = cleanIso;
    rowVals[1] = cleanIso;
    rowVals[2] = formatDisplayDateFromIso_(cleanIso) || rowVals[2];
    rowVals[3] = formatMonthYearFromIso_(cleanIso) || rowVals[3];
  }

  rowVals[7]  = nextStatus;
  rowVals[8]  = organizerName;
  rowVals[9]  = coOrganizer;
  rowVals[10] = title;
  rowVals[11] = String(payload.description || '').trim();
  rowVals[12] = String(payload.location || '').trim();
  rowVals[13] = formatCellTime_(payload.startTime) || '19:30';
  rowVals[14] = formatCellTime_(payload.endTime) || '22:00';
  rowVals[15] = String(payload.costPerPerson || '').trim();
  rowVals[16] = String(payload.accessoriesNeeded || '').trim();
  rowVals[17] = prospective;
  rowVals[18] = String(payload.imgUrl || rowVals[18] || '').trim();
  rowVals[19] = nowIso;

  sheet.getRange('A:D').setNumberFormat('@');
  sheet.getRange('N:O').setNumberFormat('@');
  sheet.getRange(rowIndex, 1, 1, SOCIALS_HEADERS.length).setValues([rowVals]);
  SpreadsheetApp.flush();

  return buildFullState_();
}

/**
 * Releases/clears a claimed social slot back to OPEN while preserving the calendar row.
 */
function deleteSocialSlot_(payload) {
  var slotId = String(payload.slotId || payload.SlotID || '').trim();
  if (!slotId) throw new Error('Missing slotId to release.');

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES.SOCIALS);
  var rowIndex = findRowByFirstCol_(sheet, slotId);
  if (rowIndex === -1) throw new Error('Slot not found: ' + slotId);

  var settings = getSettingsMap_();
  var rowVals = sheet.getRange(rowIndex, 1, 1, SOCIALS_HEADERS.length).getValues()[0];
  var socialType = String(rowVals[5] || 'PAID').toUpperCase();
  var cleanIso = formatCellDateISO_(rowVals[1]) || formatCellDateISO_(rowVals[0]);
  if (cleanIso) {
    rowVals[0] = cleanIso;
    rowVals[1] = cleanIso;
    rowVals[2] = formatDisplayDateFromIso_(cleanIso) || rowVals[2];
    rowVals[3] = formatMonthYearFromIso_(cleanIso) || rowVals[3];
  }

  rowVals[7]  = 'OPEN';
  rowVals[8]  = '';
  rowVals[9]  = '';
  rowVals[10] = '';
  rowVals[11] = '';
  rowVals[12] = '';
  rowVals[13] = settings.DEFAULT_START_TIME || '19:30';
  rowVals[14] = settings.DEFAULT_END_TIME || '22:00';
  rowVals[15] = socialType === 'FREE' ? 'Free / Sub-£20 kitty' : '';
  rowVals[16] = '';
  rowVals[17] = true;
  rowVals[18] = '';
  rowVals[19] = new Date().toISOString();

  sheet.getRange('A:D').setNumberFormat('@');
  sheet.getRange('N:O').setNumberFormat('@');
  sheet.getRange(rowIndex, 1, 1, SOCIALS_HEADERS.length).setValues([rowVals]);
  SpreadsheetApp.flush();

  return buildFullState_();
}

/**
 * Adds a member to the Members tab (if not already present) and returns updated state.
 */
function addMemberRecord_(payload) {
  var name = String(payload.name || '').trim();
  if (!name) throw new Error('Member name is required.');
  var role = String(payload.role || 'Member').trim() || 'Member';
  var isPO = isProgrammeOfficerRow_(role, payload.isProgrammeOfficer);
  if (isPO && role === 'Member') {
    role = 'Programme Officer';
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES.MEMBERS);
  var members = readMembers_();

  for (var i = 0; i < members.length; i++) {
    if (members[i].name.toLowerCase() === name.toLowerCase()) {
      // Reactivate if inactive
      if (!members[i].active) {
        sheet.getRange(members[i].rowIndex, 9).setValue(true);
        sheet.getRange(members[i].rowIndex, 10).setValue(isPO);
        if (role && role !== 'Member') sheet.getRange(members[i].rowIndex, 3).setValue(role);
        SpreadsheetApp.flush();
        return buildFullState_();
      }
      throw new Error(name + ' is already on the members list.');
    }
  }

  var slug = slugify_(name);
  var initQuota = '📋 Needs Both';
  sheet.appendRow([slug, name, role, 0, 0, '', '', initQuota, true, isPO]);
  SpreadsheetApp.flush();
  return buildFullState_();
}

/**
 * Marks or unmarks a member as a Programme Officer (Calendar Coordinator).
 */
function toggleProgrammeOfficer_(payload) {
  var name = String(payload.name || '').trim();
  var memberId = String(payload.memberId || '').trim();
  if (!name && !memberId) throw new Error('Member name is required.');

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES.MEMBERS);
  var members = readMembers_();
  var target = null;

  for (var i = 0; i < members.length; i++) {
    if ((memberId && members[i].id === memberId) || (name && members[i].name.toLowerCase() === name.toLowerCase())) {
      target = members[i];
      break;
    }
  }
  if (!target) throw new Error('Member not found: ' + name);

  var nextPO;
  if (typeof payload.isProgrammeOfficer === 'boolean') {
    nextPO = payload.isProgrammeOfficer;
  } else if (typeof payload.isProgrammeOfficer === 'string' && payload.isProgrammeOfficer.trim() !== '') {
    nextPO = isProgrammeOfficerRow_('', payload.isProgrammeOfficer);
  } else {
    nextPO = !target.isProgrammeOfficer;
  }

  var nextRole = target.role || 'Member';
  if (nextPO && (nextRole === 'Member' || !nextRole)) {
    nextRole = 'Programme Officer';
  } else if (!nextPO && isProgrammeOfficerRow_(nextRole, false)) {
    nextRole = 'Member';
  }

  sheet.getRange(target.rowIndex, 3).setValue(nextRole);
  sheet.getRange(target.rowIndex, 10).setValue(nextPO);
  SpreadsheetApp.flush();
  return buildFullState_();
}

/**
 * Deletes a member from the Members tab and releases any future slots they had claimed.
 */
function deleteMemberRecord_(payload) {
  var name = String(payload.name || '').trim();
  var memberId = String(payload.memberId || '').trim();
  if (!name && !memberId) throw new Error('Provide member name or memberId to remove.');

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES.MEMBERS);
  var members = readMembers_();
  var targetRow = -1;

  for (var i = 0; i < members.length; i++) {
    var m = members[i];
    if ((memberId && m.id === memberId) || (name && m.name.toLowerCase() === name.toLowerCase())) {
      targetRow = m.rowIndex;
      break;
    }
  }

  if (targetRow === -1) throw new Error('Member not found.');
  sheet.deleteRow(targetRow);
  SpreadsheetApp.flush();

  return buildFullState_();
}

/**
 * Synchronises Members tab (generates missing MemberIDs, counts 1 Paid + 1 Free per member)
 * and releases any future Socials slots whose OrganizerName is no longer an active member.
 */
function syncMembersAndQuotas_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var membersSheet = ss.getSheetByName(SHEET_NAMES.MEMBERS);
  var socialsSheet = ss.getSheetByName(SHEET_NAMES.SOCIALS);
  var settings = getSettingsMap_();

  var membersLast = membersSheet.getLastRow();
  var memberRows = membersLast >= 2
    ? membersSheet.getRange(2, 1, membersLast - 1, MEMBERS_HEADERS.length).getValues()
    : [];

  var activeByLower = {};
  var seenIds = {};
  var membersDirty = false;

  for (var i = 0; i < memberRows.length; i++) {
    var r = memberRows[i];
    var mName = String(r[1] || '').trim();
    if (!mName) continue;

    // Auto-populate missing MemberID
    if (!String(r[0] || '').trim()) {
      var baseId = slugify_(mName) || ('member-' + (i + 1));
      var uniqId = baseId;
      var suffix = 2;
      while (seenIds[uniqId]) {
        uniqId = baseId + '-' + suffix++;
      }
      r[0] = uniqId;
      membersDirty = true;
    }
    seenIds[String(r[0]).trim()] = true;

    // Default Role and Active if blank
    if (!String(r[2] || '').trim()) {
      r[2] = 'Member';
      membersDirty = true;
    }
    if (r[8] === '' || r[8] === null || typeof r[8] === 'undefined') {
      r[8] = true;
      membersDirty = true;
    }

    var isActive = r[8] === true || String(r[8]).toUpperCase() === 'TRUE' || String(r[8]).toUpperCase() === 'YES';
    if (isActive) {
      activeByLower[mName.toLowerCase()] = {
        canonicalName: mName,
        paidCount: 0,
        freeCount: 0,
        paidTitles: [],
        freeTitles: []
      };
    }
  }

  // Scan Socials tab: release orphaned future slots if AUTO_RELEASE_ON_MEMBER_DELETE is TRUE, and tally quotas
  var autoRelease = String(settings.AUTO_RELEASE_ON_MEMBER_DELETE || 'TRUE').toUpperCase() !== 'FALSE';
  var horizon = getActiveHorizonFloorIso_(socialsSheet, settings);
  var tz = Session.getScriptTimeZone() || 'Europe/London';
  var todayISO = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');

  var socialsLast = socialsSheet.getLastRow();
  var socialRows = socialsLast >= 2
    ? socialsSheet.getRange(2, 1, socialsLast - 1, SOCIALS_HEADERS.length).getValues()
    : [];
  var socialsDirty = false;
  var releasedSlots = 0;

  for (var s = 0; s < socialRows.length; s++) {
    var sr = socialRows[s];
    var dateISO = formatCellDateISO_(sr[1]);
    var socialType = String(sr[5] || '').toUpperCase();
    var status = String(sr[7] || 'OPEN').toUpperCase();
    var orgName = String(sr[8] || '').trim();
    var coOrgName = String(sr[9] || '').trim();
    var title = String(sr[10] || '').trim();
    var displayDate = formatDisplayDateFromIso_(dateISO) || String(sr[2] || dateISO).trim();

    if (status !== 'OPEN' && orgName) {
      var orgEntry = activeByLower[orgName.toLowerCase()];

      // If member was removed from Members sheet, auto-release future slots
      if (!orgEntry && autoRelease && dateISO >= todayISO) {
        sr[7]  = 'OPEN';
        sr[8]  = '';
        sr[9]  = '';
        sr[10] = '';
        sr[11] = '';
        sr[12] = '';
        sr[13] = settings.DEFAULT_START_TIME || '19:30';
        sr[14] = settings.DEFAULT_END_TIME || '22:00';
        sr[15] = socialType === 'FREE' ? 'Free / Sub-£20 kitty' : '';
        sr[16] = '';
        sr[17] = true;
        sr[18] = '';
        sr[19] = new Date().toISOString();
        socialsDirty = true;
        releasedSlots++;
        continue;
      }

      if (orgEntry) {
        // Normalize exact spelling from Members sheet if case differed
        if (orgName !== orgEntry.canonicalName) {
          sr[8] = orgEntry.canonicalName;
          socialsDirty = true;
        }
        if (dateISO >= horizon.floorIso) {
          var label = (title || 'Untitled') + ' (' + displayDate + ')';
          if (socialType === 'PAID') {
            orgEntry.paidCount++;
            orgEntry.paidTitles.push(label);
          } else if (socialType === 'FREE') {
            orgEntry.freeCount++;
            orgEntry.freeTitles.push(label);
          }
        }
      }

      // Check CoOrganizerName: clear if deleted in future, otherwise credit quota?
      // Note: primary organizer owns the slot; co-organizer is credited too if listed, or we keep primary strict.
      // Let's clear orphaned co-organizer if deleted.
      if (coOrgName && !activeByLower[coOrgName.toLowerCase()] && autoRelease && dateISO >= todayISO) {
        sr[9] = '';
        socialsDirty = true;
      }
    }
  }

  if (socialsDirty && socialRows.length > 0) {
    socialsSheet.getRange(2, 1, socialRows.length, SOCIALS_HEADERS.length).setValues(socialRows);
  }

  // Write recalculated quota columns back to Members sheet
  for (var j = 0; j < memberRows.length; j++) {
    var mr = memberRows[j];
    var mKey = String(mr[1] || '').trim().toLowerCase();
    var isAct = mr[8] === true || String(mr[8]).toUpperCase() === 'TRUE' || String(mr[8]).toUpperCase() === 'YES';
    var isPO = mKey ? isProgrammeOfficerRow_(mr[2], mr[9]) : '';

    var paidCnt = 0;
    var freeCnt = 0;
    var paidSummary = '';
    var freeSummary = '';
    var quotaText = 'Inactive';

    if (mKey && isAct && activeByLower[mKey]) {
      var stats = activeByLower[mKey];
      paidCnt = stats.paidCount;
      freeCnt = stats.freeCount;
      paidSummary = stats.paidTitles.join(' | ');
      freeSummary = stats.freeTitles.join(' | ');

      if (paidCnt >= 1 && freeCnt >= 1) quotaText = '✅ Complete (1 Paid + 1 Free)';
      else if (paidCnt >= 1) quotaText = '⏳ Needs Free (3rd Wed)';
      else if (freeCnt >= 1) quotaText = '⏳ Needs Paid (1st Wed)';
      else quotaText = '📋 Needs Both';
    } else if (!mKey) {
      mr[0] = '';
      mr[2] = '';
      mr[8] = '';
      mr[9] = '';
      paidSummary = '';
      freeSummary = '';
      quotaText = '';
      paidCnt = '';
      freeCnt = '';
    }

    if (mr[3] !== paidCnt || mr[4] !== freeCnt || mr[5] !== paidSummary || mr[6] !== freeSummary || mr[7] !== quotaText || mr[9] !== isPO) {
      mr[3] = paidCnt;
      mr[4] = freeCnt;
      mr[5] = paidSummary;
      mr[6] = freeSummary;
      mr[7] = quotaText;
      mr[9] = isPO;
      membersDirty = true;
    }
  }

  if (membersDirty && memberRows.length > 0) {
    membersSheet.getRange(2, 1, memberRows.length, MEMBERS_HEADERS.length).setValues(memberRows);
  }

  return {
    memberCount: Object.keys(activeByLower).length,
    releasedSlots: releasedSlots
  };
}

function renameOrganizerInSocials_(oldName, newName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var socialsSheet = ss.getSheetByName(SHEET_NAMES.SOCIALS);
  if (!socialsSheet || socialsSheet.getLastRow() < 2) return;

  var range = socialsSheet.getRange(2, 1, socialsSheet.getLastRow() - 1, SOCIALS_HEADERS.length);
  var rows = range.getValues();
  var changed = false;
  var oldLower = oldName.toLowerCase();

  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][8] || '').trim().toLowerCase() === oldLower) {
      rows[i][8] = newName;
      changed = true;
    }
    if (String(rows[i][9] || '').trim().toLowerCase() === oldLower) {
      rows[i][9] = newName;
      changed = true;
    }
  }
  if (changed) range.setValues(rows);
}

function ensureMemberExists_(name) {
  var members = readMembers_();
  for (var i = 0; i < members.length; i++) {
    if (members[i].name.toLowerCase() === name.toLowerCase()) {
      if (!members[i].active) {
        var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.MEMBERS);
        sheet.getRange(members[i].rowIndex, 9).setValue(true);
      }
      return;
    }
  }
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.MEMBERS);
  sheet.appendRow([slugify_(name), name, 'Member', 0, 0, '', '', '📋 Needs Both', true, false]);
}

// ============================================================================
// GEMINI AI CO-PILOT INTEGRATION
// ============================================================================

function compareSemverDesc_(a, b) {
  var pa = String(a.ver || '0').split('.');
  var pb = String(b.ver || '0').split('.');
  var majDiff = (parseInt(pb[0], 10) || 0) - (parseInt(pa[0], 10) || 0);
  if (majDiff !== 0) return majDiff;
  return (parseInt(pb[1], 10) || 0) - (parseInt(pa[1], 10) || 0);
}

function appendUniqueModels_(target, items) {
  for (var i = 0; i < items.length; i++) {
    var m = String(items[i] || '').trim();
    if (m && target.indexOf(m) === -1) target.push(m);
  }
}

/**
 * Dynamically discovers the newest free-tier Gemini Flash & Flash-Lite models
 * available to this API key (cached 6 hours), with rolling-alias fallbacks.
 */
function resolveFlashModelChain_(apiKey, configuredModel) {
  var cfg = String(configuredModel || '').trim();
  var cfgUpper = cfg.toUpperCase();
  var cacheKey = 'BRT_DYNAMIC_FLASH_MODELS_V1';
  var discovered = null;

  try {
    if (typeof CacheService !== 'undefined') {
      var cachedRaw = CacheService.getScriptCache().get(cacheKey);
      if (cachedRaw) discovered = JSON.parse(cachedRaw);
    }
  } catch (cacheReadErr) {}

  if (!discovered) {
    var flashModels = [];
    var flashLiteModels = [];
    try {
      var listUrl = 'https://generativelanguage.googleapis.com/v1beta/models?key=' + encodeURIComponent(apiKey);
      var listRes = UrlFetchApp.fetch(listUrl, { method: 'get', muteHttpExceptions: true });
      if (listRes.getResponseCode() >= 200 && listRes.getResponseCode() < 300) {
        var listJson = JSON.parse(listRes.getContentText() || '{}');
        var models = Array.isArray(listJson.models) ? listJson.models : [];
        for (var i = 0; i < models.length; i++) {
          var item = models[i];
          var methods = Array.isArray(item.supportedGenerationMethods) ? item.supportedGenerationMethods : [];
          if (methods.indexOf('generateContent') === -1) continue;

          var name = String(item.name || '');
          var mFlash = /^models\/(gemini-(\d+(?:\.\d+)?)-flash)$/i.exec(name);
          if (mFlash) {
            flashModels.push({ id: mFlash[1], ver: mFlash[2] });
            continue;
          }
          var mLite = /^models\/(gemini-(\d+(?:\.\d+)?)-flash-lite)$/i.exec(name);
          if (mLite) {
            flashLiteModels.push({ id: mLite[1], ver: mLite[2] });
          }
        }
        flashModels.sort(compareSemverDesc_);
        flashLiteModels.sort(compareSemverDesc_);
      }
    } catch (discoverErr) {}

    discovered = {
      flash: flashModels.map(function (x) { return x.id; }),
      lite: flashLiteModels.map(function (x) { return x.id; })
    };

    try {
      if (typeof CacheService !== 'undefined' && (discovered.flash.length || discovered.lite.length)) {
        CacheService.getScriptCache().put(cacheKey, JSON.stringify(discovered), 21600);
      }
    } catch (cacheWriteErr) {}
  }

  var modelsToTry = [];
  if (cfg && cfgUpper !== 'AUTO' && cfgUpper !== 'LATEST' && cfg !== 'gemini-2.5-flash') {
    appendUniqueModels_(modelsToTry, [cfg]);
  }
  appendUniqueModels_(modelsToTry, discovered.flash || []);
  appendUniqueModels_(modelsToTry, ['gemini-flash-latest', 'gemini-2.5-flash']);
  appendUniqueModels_(modelsToTry, discovered.lite || []);
  appendUniqueModels_(modelsToTry, ['gemini-flash-lite-latest', 'gemini-2.5-flash-lite', 'gemini-2.0-flash']);
  return modelsToTry;
}

function callGeminiAi_(payload) {
  var props = PropertiesService.getScriptProperties();
  var apiKey = String(props.getProperty('GEMINI_API_KEY') || '').trim();
  var settings = null;
  if (!apiKey) {
    settings = getSettingsMap_();
    apiKey = getGeminiApiKey_(settings);
  }
  if (!apiKey) {
    var keyErr = new Error('Gemini API key is not configured yet. Click "🍻 BRT Socials Admin -> 5. Set Gemini API Key" (stored in Script Properties).');
    keyErr.code = 'NO_GEMINI_KEY';
    throw keyErr;
  }

  var mode = String(payload.mode || 'ideas').toLowerCase(); // 'ideas' | 'expand'
  var socialType = String(payload.socialType || 'FREE').toUpperCase();
  var monthYear = String(payload.monthYear || 'Upcoming Month');
  var displayDate = String(payload.displayDate || 'Wednesday');
  var userPrompt = String(payload.userPrompt || '').trim();
  var draftTitle = String(payload.draftTitle || '').trim();
  var draftLocation = String(payload.draftLocation || '').trim();
  var draftDescription = String(payload.draftDescription || '').trim();

  // Prefer existingTitles sent from the client to avoid slow Spreadsheet reads
  var existingTitles = Array.isArray(payload.existingTitles)
    ? payload.existingTitles.map(function (t) { return String(t || '').trim(); }).filter(Boolean).slice(0, 22)
    : readSocials_()
        .filter(function (s) { return s.status !== 'OPEN' && s.title; })
        .map(function (s) { return s.title + ' (' + s.monthYear + ')'; });

  var clubArea = 'Beverley & East Yorkshire (Hull, Westwood, Molescroft, Walkington)';
  var clubName = 'Beverley Round Table';
  var ruleDesc = socialType === 'PAID'
    ? '1ST WED PAID: Commercially run activity, venue booking, experience, or paid night out.'
    : '3RD WED FREE / SUB-£20: Free to attend or max £20 total group spend on props/kit (brains & banter over budget).';

  var promptLines = [
    'Social Secretary Co-Pilot for ' + clubName + ' (men 18-45, ' + clubArea + '). Energetic, witty, practical, welcoming to new guys.',
    'Slot: ' + displayDate + ' (' + monthYear + ') | Rule: ' + ruleDesc,
    existingTitles.length ? ('Already planned (do not repeat): ' + existingTitles.join(', ')) : ''
  ];

  if (mode === 'expand') {
    promptLines.push(
      'TASK: Expand this draft into 1 crisp, ready-to-run social plan (timings are set later on Spond).',
      'Draft: ' + [draftTitle, draftLocation, draftDescription, userPrompt].filter(Boolean).join(' | '),
      'Return JSON: {"suggestions": [1 object]}.'
    );
  } else {
    promptLines.push(
      'TASK: Pitch 3 distinct social ideas tailored to ' + monthYear + ' (UK weather/daylight) in Beverley/Hull (timings set later on Spond).',
      userPrompt ? ('Vibe/constraint: "' + userPrompt + '"') : 'Mix: 1 classic, 1 left-field/hilarious, 1 easy prospective-member icebreaker.',
      'Return JSON: {"suggestions": [3 objects]}.'
    );
  }

  promptLines.push(
    'Each suggestion object keys: title (3-6 words + optional emoji), description (1-2 punchy sentences), location (specific Beverley/Hull spot), costPerPerson ("' + (socialType === 'PAID' ? '£XX pp' : 'Free / £XX props') + '"), accessoriesNeeded (brief prep/kit list), prospectiveFriendly (true/false), whyItWorks (1 concise sentence).'
  );

  var configuredModel = String(props.getProperty('GEMINI_MODEL') || (settings && settings.GEMINI_MODEL) || 'AUTO').trim();
  var modelsToTry = resolveFlashModelChain_(apiKey, configuredModel);
  var maxAttempts = Math.min(modelsToTry.length, 4);

  var lastError = null;
  for (var i = 0; i < maxAttempts; i++) {
    var model = modelsToTry[i];
    var endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/' +
      encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(apiKey);

    var genConfig = {
      temperature: 0.85,
      maxOutputTokens: 650,
      responseMimeType: 'application/json'
    };
    if (/-(2\.5|[3-9](?:\.\d+)?)-flash|^gemini-flash(?:-lite)?-latest$/i.test(model)) {
      genConfig.thinkingConfig = { thinkingBudget: 0 };
    }

    var requestBody = {
      contents: [{ parts: [{ text: promptLines.join('\n') }] }],
      generationConfig: genConfig
    };

    var res = UrlFetchApp.fetch(endpoint, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(requestBody),
      muteHttpExceptions: true
    });

    var code = res.getResponseCode();
    var text = res.getContentText();

    // Retry without thinkingConfig if an alias model rejects it with HTTP 400
    if (code === 400 && genConfig.thinkingConfig && /thinking/i.test(text)) {
      delete genConfig.thinkingConfig;
      res = UrlFetchApp.fetch(endpoint, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(requestBody),
        muteHttpExceptions: true
      });
      code = res.getResponseCode();
      text = res.getContentText();
    }

    if (code >= 200 && code < 300) {
      var parsed = JSON.parse(text);
      var rawContent = parsed && parsed.candidates && parsed.candidates[0] &&
        parsed.candidates[0].content && parsed.candidates[0].content.parts &&
        parsed.candidates[0].content.parts[0] && parsed.candidates[0].content.parts[0].text;

      if (!rawContent) throw new Error('Gemini returned an empty response.');
      var cleaned = rawContent.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      var jsonOut = JSON.parse(cleaned);
      if (!jsonOut || !Array.isArray(jsonOut.suggestions)) {
        throw new Error('Gemini JSON missing suggestions array.');
      }
      return {
        model: model,
        mode: mode,
        suggestions: jsonOut.suggestions
      };
    }

    lastError = 'Gemini HTTP ' + code + ' (' + model + '): ' + text.slice(0, 300);
    // Try next Flash/Flash-Lite model on retired model (404), free-tier rate limit (429), or transient server errors (500/503)
    if (code !== 404 && code !== 429 && code !== 503 && code !== 500) break;
  }

  throw new Error(lastError || 'Gemini API call failed.');
}

// ============================================================================
// READERS & COMPATIBILITY
// ============================================================================

function isProgrammeOfficerRow_(roleVal, poFlagVal) {
  if (poFlagVal === true || poFlagVal === 1) return true;
  var flagStr = String(poFlagVal || '').trim().toUpperCase();
  if (flagStr === 'TRUE' || flagStr === 'YES' || flagStr === 'Y' || flagStr === '1') return true;
  var roleStr = String(roleVal || '').trim().toLowerCase();
  return roleStr.indexOf('programme officer') !== -1 ||
    roleStr.indexOf('program officer') !== -1 ||
    roleStr.indexOf('coordinator') !== -1 ||
    roleStr.indexOf('overseer') !== -1;
}

function readMembers_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.MEMBERS);
  if (!sheet || sheet.getLastRow() < 2) return [];

  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, MEMBERS_HEADERS.length).getValues();
  var list = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var name = String(r[1] || '').trim();
    if (!name) continue;
    var active = r[8] === '' || r[8] === true || String(r[8]).toUpperCase() === 'TRUE' || String(r[8]).toUpperCase() === 'YES';
    var role = String(r[2] || 'Member');
    list.push({
      rowIndex: i + 2,
      id: String(r[0] || slugify_(name)),
      name: name,
      role: role,
      paidCount: Number(r[3] || 0),
      freeCount: Number(r[4] || 0),
      paidSocialTitle: String(r[5] || ''),
      freeSocialTitle: String(r[6] || ''),
      quotaStatus: String(r[7] || '📋 Needs Both'),
      active: active,
      isProgrammeOfficer: isProgrammeOfficerRow_(role, r[9])
    });
  }
  return list;
}

function readSocials_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.SOCIALS);
  if (!sheet || sheet.getLastRow() < 2) return [];

  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, SOCIALS_HEADERS.length).getValues();
  var list = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var dateISO = formatCellDateISO_(r[1]) || formatCellDateISO_(r[0]);
    var slotId = dateISO || String(r[0] || '').trim();
    if (!slotId) continue;
    var status = String(r[7] || 'OPEN').toUpperCase();
    var socialType = String(r[5] || 'PAID').toUpperCase();

    list.push({
      rowIndex: i + 2,
      slotId: slotId,
      dateISO: dateISO,
      displayDate: formatDisplayDateFromIso_(dateISO) || String(r[2] || dateISO),
      monthYear: formatMonthYearFromIso_(dateISO) || String(r[3] || ''),
      wednesdayOrdinal: String(r[4] || (socialType === 'PAID' ? '1st Wednesday' : '3rd Wednesday')),
      socialType: socialType,
      budgetRule: String(r[6] || ''),
      status: status,
      organizerName: String(r[8] || '').trim(),
      coOrganizerName: String(r[9] || '').trim(),
      title: String(r[10] || '').trim(),
      description: String(r[11] || '').trim(),
      location: String(r[12] || '').trim(),
      startTime: formatCellTime_(r[13]) || '19:30',
      endTime: formatCellTime_(r[14]) || '22:00',
      costPerPerson: String(r[15] || '').trim(),
      accessoriesNeeded: String(r[16] || '').trim(),
      prospectiveFriendly: r[17] === true || String(r[17]).toUpperCase() === 'TRUE',
      imgUrl: String(r[18] || '').trim(),
      updatedAt: String(r[19] || '')
    });
  }

  list.sort(function (a, b) {
    return a.dateISO < b.dateISO ? -1 : (a.dateISO > b.dateISO ? 1 : 0);
  });
  return list;
}

/**
 * Compatibility output for site/BRT.html (?type=upcoming)
 */
function getUpcomingEventsCompat_() {
  ensureSetup_();
  var tz = Session.getScriptTimeZone() || 'Europe/London';
  var todayISO = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var socials = readSocials_();

  return socials
    .filter(function (s) {
      return s.status !== 'OPEN' && s.dateISO >= todayISO && s.title;
    })
    .map(function (s) {
      var timeStr = (s.startTime || '19:30').slice(0, 5);
      return {
        Title: s.title,
        DateTime: s.dateISO + 'T' + timeStr + ':00.000Z',
        Location: s.location || 'Beverley TBC',
        Img: s.imgUrl || '',
        Organizer: s.organizerName,
        SocialType: s.socialType,
        Description: s.description
      };
    });
}

// ============================================================================
// SHEET HELPERS & STYLING
// ============================================================================

function getOrCreateSheet_(ss, name) {
  var s = ss.getSheetByName(name);
  return s || ss.insertSheet(name);
}

function ensureHeaders_(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    return;
  }
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
}

function seedDefaultSettings_(sheet) {
  var existing = {};
  if (sheet.getLastRow() >= 2) {
    var vals = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < vals.length; i++) {
      var k = String(vals[i][0] || '').trim();
      if (k) existing[k] = true;
    }
  }
  for (var j = 0; j < DEFAULT_SETTINGS.length; j++) {
    var row = DEFAULT_SETTINGS[j];
    if (!existing[row[0]]) {
      sheet.appendRow(row);
    }
  }
}

function getSettingsMap_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.SETTINGS);
  var map = {};
  if (!sheet || sheet.getLastRow() < 2) return map;
  var vals = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  for (var i = 0; i < vals.length; i++) {
    var k = String(vals[i][0] || '').trim();
    if (k) map[k] = String(vals[i][1] || '').trim();
  }
  return map;
}

function migrateSettingCellToProp_(sheetKey, propKey, sheetVal) {
  var val = String(sheetVal || '').trim();
  if (!val) return '';

  var props = PropertiesService.getScriptProperties();
  var existingProp = props.getProperty(propKey);
  if (!existingProp) {
    props.setProperty(propKey, val);
    existingProp = val;
  }

  // Clear the secret cell in the Settings tab so secrets do not sit in sheet cells
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES.SETTINGS);
  if (sheet && sheet.getLastRow() >= 2) {
    var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues();
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][0] || '').trim() === sheetKey) {
        sheet.getRange(i + 2, 2).setValue('');
        sheet.getRange(i + 2, 3).setValue('Moved to Script Properties (' + propKey + ')');
      }
    }
  }
  return String(existingProp || '').trim();
}

function getGeminiApiKey_(settings) {
  var props = PropertiesService.getScriptProperties();
  var fromProps = props.getProperty('GEMINI_API_KEY');
  var fromSheet = settings && settings.GEMINI_API_KEY ? String(settings.GEMINI_API_KEY).trim() : '';

  if (fromSheet) {
    var migrated = migrateSettingCellToProp_('GEMINI_API_KEY', 'GEMINI_API_KEY', fromSheet);
    if (migrated) return migrated;
  }
  return fromProps ? String(fromProps).trim() : '';
}

function getTablePin_(settings) {
  var props = PropertiesService.getScriptProperties();
  var fromProps = props.getProperty('TABLE_PIN');
  if (fromProps && String(fromProps).trim()) return String(fromProps).trim();

  var fromSheetTable = settings && settings.TABLE_PIN ? String(settings.TABLE_PIN).trim() : '';
  if (fromSheetTable) {
    return migrateSettingCellToProp_('TABLE_PIN', 'TABLE_PIN', fromSheetTable) || '';
  }

  return '';
}

function getAdminPin_(settings) {
  var props = PropertiesService.getScriptProperties();
  var fromProps = props.getProperty('ADMIN_PIN');
  if (fromProps && String(fromProps).trim()) return String(fromProps).trim();

  var fromSheetAdmin = settings && settings.ADMIN_PIN ? String(settings.ADMIN_PIN).trim() : '';
  if (fromSheetAdmin) {
    return migrateSettingCellToProp_('ADMIN_PIN', 'ADMIN_PIN', fromSheetAdmin);
  }
  return '';
}

function requirePin_(payload, level) {
  var props = PropertiesService.getScriptProperties();
  var tablePin = String(props.getProperty('TABLE_PIN') || '').trim();
  var adminPin = String(props.getProperty('ADMIN_PIN') || '').trim();

  if (!tablePin && !adminPin) {
    var settings = getSettingsMap_();
    tablePin = getTablePin_(settings);
    adminPin = getAdminPin_(settings);
  }
  var provided = String((payload && payload.pin) || '').trim();

  if (!tablePin && !adminPin) {
    var unconfiguredErr = new Error('TABLE_PIN is not configured in Script Properties yet. Add TABLE_PIN in Apps Script Project Settings -> Script Properties.');
    unconfiguredErr.code = 'INVALID_PIN';
    throw unconfiguredErr;
  }

  if (level === 'admin' && adminPin) {
    if (!provided || provided !== adminPin) {
      var adminErr = new Error('Admin / Programme Officer PIN required for member roster changes.');
      adminErr.code = 'INVALID_PIN';
      throw adminErr;
    }
    return true;
  }

  var valid = Boolean(provided && ((tablePin && provided === tablePin) || (adminPin && provided === adminPin)));
  if (!valid) {
    var pinErr = new Error('Table PIN required to save changes or use Gemini AI. Please enter your Beverley Round Table PIN.');
    pinErr.code = 'INVALID_PIN';
    throw pinErr;
  }
  return true;
}

function styleSheetHeader_(sheet, colCount, bgHex, fgHex) {
  var headerRange = sheet.getRange(1, 1, 1, colCount);
  headerRange
    .setBackground(bgHex)
    .setFontColor(fgHex)
    .setFontWeight('bold')
    .setVerticalAlignment('middle');
  sheet.setRowHeight(1, 32);
  sheet.setFrozenRows(1);
}

function applySheetConditionalFormatting_(socialsSheet, membersSheet) {
  // Highlight OPEN vs CONFIRMED vs IDEA in Socials!H:H and PAID vs FREE in Socials!F:F
  var statusRange = socialsSheet.getRange('H2:H200');
  var typeRange = socialsSheet.getRange('F2:F200');
  var rules = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('CONFIRMED')
      .setBackground('#D1FAE5').setFontColor('#065F46')
      .setRanges([statusRange]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('IDEA')
      .setBackground('#FEF3C7').setFontColor('#92400E')
      .setRanges([statusRange]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('OPEN')
      .setBackground('#F3F4F6').setFontColor('#4B5563')
      .setRanges([statusRange]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('PAID')
      .setBackground('#FBAF33').setFontColor('#1D1D1A')
      .setRanges([typeRange]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('FREE')
      .setBackground('#CCFBF1').setFontColor('#0F766E')
      .setRanges([typeRange]).build()
  ];
  socialsSheet.setConditionalFormatRules(rules);

  var quotaRange = membersSheet.getRange('H2:H200');
  membersSheet.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains('Complete')
      .setBackground('#D1FAE5').setFontColor('#065F46')
      .setRanges([quotaRange]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains('Needs')
      .setBackground('#FEF3C7').setFontColor('#92400E')
      .setRanges([quotaRange]).build()
  ]);
}

function getWednesdaysInMonth_(year, month0) {
  var list = [];
  var daysInMonth = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  for (var d = 1; d <= daysInMonth; d++) {
    var dt = new Date(Date.UTC(year, month0, d));
    if (dt.getUTCDay() === 3) list.push(dt);
  }
  return list;
}

function findRowByFirstCol_(sheet, val) {
  if (!sheet || sheet.getLastRow() < 2) return -1;
  var colVals = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  var targetIso = formatCellDateISO_(val);
  for (var i = 0; i < colVals.length; i++) {
    var rawA = String(colVals[i][0] || '').trim();
    if (rawA === val) return i + 2;
    if (targetIso) {
      var cellIso = formatCellDateISO_(colVals[i][1]) || formatCellDateISO_(colVals[i][0]);
      if (cellIso === targetIso) return i + 2;
    }
  }
  return -1;
}

function formatCellYearMonth_(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) {
    return Utilities.formatDate(v, Session.getScriptTimeZone() || 'Europe/London', 'yyyy-MM');
  }
  var s = String(v).trim();
  var m = /^(\d{4})-(\d{2})/.exec(s);
  if (m) return m[1] + '-' + m[2];
  var iso = formatCellDateISO_(s);
  return /^\d{4}-\d{2}/.test(iso) ? iso.slice(0, 7) : '';
}

function formatCellDateISO_(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) {
    return Utilities.formatDate(v, Session.getScriptTimeZone() || 'Europe/London', 'yyyy-MM-dd');
  }
  var s = String(v).trim();
  var isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (isoMatch) return isoMatch[1] + '-' + isoMatch[2] + '-' + isoMatch[3];
  var shortMonths = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
  var jsMatch = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(\d{4})/i.exec(s);
  if (jsMatch) {
    return jsMatch[3] + '-' + shortMonths[jsMatch[1].toLowerCase()] + '-' + pad2_(parseInt(jsMatch[2], 10));
  }
  return s.slice(0, 10);
}

function formatDisplayDateFromIso_(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
  if (!m) return '';
  var shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var y = parseInt(m[1], 10);
  var m0 = parseInt(m[2], 10) - 1;
  var dayNum = parseInt(m[3], 10);
  var dt = new Date(Date.UTC(y, m0, dayNum));
  return shortDays[dt.getUTCDay()] + ' ' + dayNum + ' ' + shortMonths[m0] + ' ' + y;
}

function formatMonthYearFromIso_(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
  if (!m) return '';
  var monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  var m0 = parseInt(m[2], 10) - 1;
  return monthNames[m0] + ' ' + m[1];
}

function formatCellTime_(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) {
    return Utilities.formatDate(v, Session.getScriptTimeZone() || 'Europe/London', 'HH:mm');
  }
  var s = String(v).trim();
  var tm = /\b(\d{1,2}):(\d{2})(?::\d{2})?\b/.exec(s);
  if (tm) return pad2_(parseInt(tm[1], 10)) + ':' + tm[2];
  return s;
}

function slugify_(str) {
  return String(str || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function pad2_(n) {
  return (n < 10 ? '0' : '') + n;
}

function mergeObjects_(a, b) {
  var out = {};
  var k;
  for (k in a) { if (Object.prototype.hasOwnProperty.call(a, k)) out[k] = a[k]; }
  for (k in b) { if (Object.prototype.hasOwnProperty.call(b, k)) out[k] = b[k]; }
  return out;
}

function withScriptLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function jsonOk_(data) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonError_(message, code) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: false, error: message, code: code || 'ERROR' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonRawResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
