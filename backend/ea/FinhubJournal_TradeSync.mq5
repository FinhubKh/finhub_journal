//+------------------------------------------------------------------+
//|                                    FinhubJournal_TradeSync.mq5    |
//| Sends full closed trade history to FinhubKH Journal on start     |
//| Read-only: only reads history, never places/modifies trades.     |
//+------------------------------------------------------------------+
#property strict
#property version   "1.03"

input string SyncKey = "";  // Paste sync key from Settings > Account (per trading account)
const string EndpointURL  = "https://finhubjournal.vercel.app/v1/ea/sync";

//+------------------------------------------------------------------+
string JsonEscape(string s)
  {
   StringReplace(s, "\\", "\\\\");
   StringReplace(s, "\"", "\\\"");
   return s;
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
   string json = "{\"trades\":[";
   int    count = 0;

   for(int i = 0; i < total; i++)
     {
      ulong dealTicket = HistoryDealGetTicket(i);
      if(dealTicket == 0) continue;

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
      string direction = (dealDir == DEAL_TYPE_SELL) ? "buy" : "sell";

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

      if(count > 0) json += ",";
      json += "{";
      json += "\"ticket\":" + IntegerToString(dealTicket) + ",";
      json += "\"symbol\":\"" + symbol + "\",";
      json += "\"direction\":\"" + direction + "\",";
      json += "\"entry_price\":" + DoubleToString(entryPx, 5) + ",";
      json += "\"exit_price\":" + DoubleToString(exitPx, 5) + ",";
      json += "\"lot_size\":" + DoubleToString(volume, 2) + ",";
      json += "\"pnl_raw\":" + DoubleToString(profit, 2) + ",";
      json += "\"pnl_usd\":" + DoubleToString(profit, 2) + ",";
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

   Print("FinhubJournal_TradeSync: Syncing ", count, " trades. PnL uses your journal account currency (USD or Cent).");
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
