//+------------------------------------------------------------------+
//|                                    FinhubJournal_TradeSync.mq5    |
//| Sends full closed trade history to FinhubKH Journal on start     |
//| Read-only: only reads history, never places/modifies trades.     |
//+------------------------------------------------------------------+
#property strict
#property version   "1.02"

input string SyncKey = "";  // Paste sync key from Settings > Account (per trading account)
const string EndpointURL  = "https://finhubjournal.vercel.app/v1/ea/sync";

struct AccountCurrencyInfo
  {
   string currency;
   bool   is_cent;
   double pnl_divisor;
  };

//+------------------------------------------------------------------+
void ToLower(string &s)
  {
   for(int i = 0; i < StringLen(s); i++)
     {
      ushort c = StringGetCharacter(s, i);
      if(c >= 'A' && c <= 'Z')
         StringSetCharacter(s, i, (ushort)(c + 32));
     }
  }

//+------------------------------------------------------------------+
string JsonEscape(string s)
  {
   StringReplace(s, "\\", "\\\\");
   StringReplace(s, "\"", "\\\"");
   return s;
  }

//+------------------------------------------------------------------+
AccountCurrencyInfo GetAccountCurrencyInfo()
  {
   AccountCurrencyInfo info;
   info.currency = AccountInfoString(ACCOUNT_CURRENCY);
   info.is_cent = false;
   info.pnl_divisor = 1.0;

   string cur = info.currency;
   ToLower(cur);

   // Cent deposit currencies: USC, EUC, GBC, etc.
   if(StringLen(cur) == 3 && StringGetCharacter(cur, 2) == 'c')
     {
      string prefix = StringSubstr(cur, 0, 2);
      if(prefix == "us" || prefix == "eu" || prefix == "gb" || prefix == "au" || prefix == "ca" || prefix == "nz" || prefix == "ch")
         info.is_cent = true;
     }

   string server = AccountInfoString(ACCOUNT_SERVER);
   string accName = AccountInfoString(ACCOUNT_NAME);
   string company = AccountInfoString(ACCOUNT_COMPANY);
   string haystack = server + " " + accName + " " + company + " " + cur;
   ToLower(haystack);

   if(StringFind(haystack, "cent") >= 0 || StringFind(haystack, "cents") >= 0 || StringFind(haystack, "micro") >= 0)
      info.is_cent = true;

   if(info.is_cent)
      info.pnl_divisor = 100.0;

   return info;
  }

//+------------------------------------------------------------------+
double NormalizePnl(double rawProfit, const AccountCurrencyInfo &info)
  {
   if(info.pnl_divisor > 1.0)
      return rawProfit / info.pnl_divisor;
   return rawProfit;
  }

//+------------------------------------------------------------------+
int OnInit()
  {
   if(SyncKey == "")
     {
      Alert("FinhubJournal_TradeSync: Please set your Sync Key in EA inputs.");
      return(INIT_FAILED);
     }
   // Allow WebRequest must be enabled for EndpointURL's domain in
   // Tools > Options > Expert Advisors > Allow WebRequest for listed URL
   SyncHistory();
   return(INIT_SUCCEEDED);
  }

//+------------------------------------------------------------------+
void SyncHistory()
  {
   datetime from = D'2000.01.01';
   datetime to   = TimeCurrent();

   if(!HistorySelect(from, to))
     {
      Print("FinhubJournal_TradeSync: HistorySelect failed.");
      return;
     }

   int total = HistoryDealsTotal();
   AccountCurrencyInfo acctInfo = GetAccountCurrencyInfo();
   if(acctInfo.is_cent)
      Print("FinhubJournal_TradeSync: Cent account detected (", acctInfo.currency,
            "). PnL will be normalized to USD (divide by ", (int)acctInfo.pnl_divisor, ").");
   else
      Print("FinhubJournal_TradeSync: Standard account (", acctInfo.currency, ").");

   string json = "{\"account_meta\":{";
   json += "\"currency\":\"" + JsonEscape(acctInfo.currency) + "\",";
   json += "\"is_cent\":" + (acctInfo.is_cent ? "true" : "false") + ",";
   json += "\"pnl_divisor\":" + IntegerToString((int)acctInfo.pnl_divisor);
   json += "},\"trades\":[";
   int    count = 0;

   for(int i = 0; i < total; i++)
     {
      ulong dealTicket = HistoryDealGetTicket(i);
      if(dealTicket == 0) continue;

      // Only closed positions — entry deals (DEAL_ENTRY_OUT) close a position
      long entryType = HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
      if(entryType != DEAL_ENTRY_OUT) continue;

      long   posId   = HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID);
      string symbol  = HistoryDealGetString(dealTicket, DEAL_SYMBOL);
      double profit  = HistoryDealGetDouble(dealTicket, DEAL_PROFIT)
                      + HistoryDealGetDouble(dealTicket, DEAL_SWAP)
                      + HistoryDealGetDouble(dealTicket, DEAL_COMMISSION);
      double volume  = HistoryDealGetDouble(dealTicket, DEAL_VOLUME);
      double exitPx  = HistoryDealGetDouble(dealTicket, DEAL_PRICE);
      datetime closeTime = (datetime)HistoryDealGetInteger(dealTicket, DEAL_TIME);
      long   dealDir = HistoryDealGetInteger(dealTicket, DEAL_TYPE);
      string direction = (dealDir == DEAL_TYPE_SELL) ? "buy" : "sell"; // closing sell deal = was a buy position

      // Find the matching entry deal (DEAL_ENTRY_IN) for this position to get entry price/time
      double entryPx = 0; datetime openTime = closeTime; ulong entryOrderTicket = 0;
      for(int j = 0; j < total; j++)
        {
         ulong dt2 = HistoryDealGetTicket(j);
         if(dt2 == 0) continue;
         if(HistoryDealGetInteger(dt2, DEAL_POSITION_ID) == posId &&
            HistoryDealGetInteger(dt2, DEAL_ENTRY) == DEAL_ENTRY_IN)
           {
            entryPx  = HistoryDealGetDouble(dt2, DEAL_PRICE);
            openTime = (datetime)HistoryDealGetInteger(dt2, DEAL_TIME);
            entryOrderTicket = HistoryDealGetInteger(dt2, DEAL_ORDER);
            break;
           }
        }

      double rValue = 0;
      if(entryOrderTicket > 0 && HistoryOrderSelect(entryOrderTicket))
        {
         double slPrice = HistoryOrderGetDouble(entryOrderTicket, ORDER_SL);
         if(slPrice > 0 && entryPx > 0)
           {
            double riskDist = MathAbs(entryPx - slPrice);
            if(riskDist > 0)
              {
               double rr = MathAbs(exitPx - entryPx) / riskDist;
               rValue = (profit >= 0) ? rr : -rr;
              }
           }
        }

      double profitUsd = NormalizePnl(profit, acctInfo);

      if(count > 0) json += ",";
      json += "{";
      json += "\"ticket\":" + IntegerToString(dealTicket) + ",";
      json += "\"symbol\":\"" + symbol + "\",";
      json += "\"direction\":\"" + direction + "\",";
      json += "\"entry_price\":" + DoubleToString(entryPx, 5) + ",";
      json += "\"exit_price\":" + DoubleToString(exitPx, 5) + ",";
      json += "\"lot_size\":" + DoubleToString(volume, 2) + ",";
      json += "\"pnl_raw\":" + DoubleToString(profit, 2) + ",";
      json += "\"pnl_usd\":" + DoubleToString(profitUsd, 2) + ",";
      json += "\"r_value\":" + DoubleToString(rValue, 2) + ",";
      json += "\"open_time\":\"" + TimeToISO(openTime) + "\",";
      json += "\"close_time\":\"" + TimeToISO(closeTime) + "\"";
      json += "}";
      count++;
     }
   json += "]}";

   if(count == 0)
     {
      Print("FinhubJournal_TradeSync: No closed trades found.");
      return;
     }

   SendToEndpoint(json, count);
  }

//+------------------------------------------------------------------+
void SendToEndpoint(string json, int count)
  {
   char postData[];
   StringToCharArray(json, postData, 0, StringLen(json));

   string headers = "Content-Type: application/json\r\nx-sync-key: " + SyncKey + "\r\n";
   char result[];
   string resultHeaders;

   int res = WebRequest("POST", EndpointURL, headers, 5000, postData, result, resultHeaders);

   if(res == -1)
     {
      Print("FinhubJournal_TradeSync: WebRequest failed. Error ", GetLastError(),
            ". Add the endpoint URL under Tools > Options > Expert Advisors > Allow WebRequest.");
      return;
     }

   string response = CharArrayToString(result);
   Print("FinhubJournal_TradeSync: Synced ", count, " trades. Response: ", response);
  }

//+------------------------------------------------------------------+
string TimeToISO(datetime t)
  {
   MqlDateTime dt;
   TimeToStruct(t, dt);
   return StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ",
                        dt.year, dt.mon, dt.day, dt.hour, dt.min, dt.sec);
  }
//+------------------------------------------------------------------+
