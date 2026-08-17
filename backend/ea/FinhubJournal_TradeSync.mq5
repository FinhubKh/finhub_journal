//+------------------------------------------------------------------+
//|                                    FinhubJournal_TradeSync.mq5    |
//| Sends closed trade history to FinhubKH Journal.                   |
//| Read-only: only reads history, never places/modifies trades.      |
//+------------------------------------------------------------------+
#property strict
#property version   "1.06"

input string SyncKey           = "";  // Paste sync key from Settings > Account
input int    SyncEveryMinutes  = 5;   // Repeat sync while the EA stays on a chart

const string EndpointPrimary  = "https://journal.finhubkh.com/v1/ea/sync";
const string EndpointFallback = "https://finhubjournal.vercel.app/v1/ea/sync";
const int    BatchSize        = 80;
const int    RequestTimeoutMs = 60000;

int g_timerSeconds = 300;

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

   g_timerSeconds = MathMax(60, SyncEveryMinutes * 60);
   EventSetTimer(g_timerSeconds);

   // Allow WebRequest for BOTH:
   //   https://journal.finhubkh.com
   //   https://finhubjournal.vercel.app
   // Tools > Options > Expert Advisors > Allow WebRequest for listed URL
   SyncHistory(true);
   return(INIT_SUCCEEDED);
  }

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   EventKillTimer();
  }

//+------------------------------------------------------------------+
void OnTimer()
  {
   SyncHistory(false);
  }

//+------------------------------------------------------------------+
bool IsExitDeal(long entryType)
  {
   return(entryType == DEAL_ENTRY_OUT
       || entryType == DEAL_ENTRY_INOUT
       || entryType == DEAL_ENTRY_OUT_BY);
  }

//+------------------------------------------------------------------+
string TradeJson(ulong dealTicket, string symbol, string direction,
                 double entryPx, double exitPx, double volume, double profit,
                 double rValue, double slPrice, datetime openTime, datetime closeTime)
  {
   string json = "{";
   json += "\"ticket\":" + IntegerToString((long)dealTicket) + ",";
   json += "\"symbol\":\"" + JsonEscape(symbol) + "\",";
   json += "\"direction\":\"" + direction + "\",";
   json += "\"entry_price\":" + DoubleToString(entryPx, 5) + ",";
   json += "\"exit_price\":" + DoubleToString(exitPx, 5) + ",";
   json += "\"lot_size\":" + DoubleToString(volume, 2) + ",";
   json += "\"pnl_raw\":" + DoubleToString(profit, 2) + ",";
   json += "\"pnl_usd\":" + DoubleToString(profit, 2) + ",";
   json += "\"r_value\":" + DoubleToString(rValue, 2) + ",";
   json += "\"sl_price\":" + DoubleToString(slPrice, 5) + ",";
   json += "\"session\":\"" + SessionFromTime(openTime) + "\",";
   json += "\"open_time\":\"" + TimeToISO(openTime) + "\",";
   json += "\"close_time\":\"" + TimeToISO(closeTime) + "\"";
   json += "}";
   return json;
  }

//+------------------------------------------------------------------+
void FindEntry(long posId, int total,
               double &entryPx, datetime &openTime, ulong &entryOrderTicket, double &entrySl)
  {
   for(int j = 0; j < total; j++)
     {
      ulong dt2 = HistoryDealGetTicket(j);
      if(dt2 == 0) continue;
      if(HistoryDealGetInteger(dt2, DEAL_POSITION_ID) == posId &&
         HistoryDealGetInteger(dt2, DEAL_ENTRY) == DEAL_ENTRY_IN)
        {
         entryPx  = HistoryDealGetDouble(dt2, DEAL_PRICE);
         openTime = (datetime)HistoryDealGetInteger(dt2, DEAL_TIME);
         entryOrderTicket = (ulong)HistoryDealGetInteger(dt2, DEAL_ORDER);
         entrySl = HistoryDealGetDouble(dt2, DEAL_SL);
         return;
        }
     }
  }

//+------------------------------------------------------------------+
double StopLossOf(ulong outDeal, ulong entryOrderTicket, double entrySl)
  {
   double slPrice = HistoryDealGetDouble(outDeal, DEAL_SL);
   if(slPrice <= 0)
      slPrice = entrySl;
   if(slPrice <= 0 && entryOrderTicket > 0 && HistoryOrderSelect(entryOrderTicket))
      slPrice = HistoryOrderGetDouble(entryOrderTicket, ORDER_SL);
   return slPrice;
  }

//+------------------------------------------------------------------+
double CalcR(double entryPx, double exitPx, double profit, double slPrice)
  {
   if(slPrice <= 0 || entryPx <= 0)
      return 0;
   double riskDist = MathAbs(entryPx - slPrice);
   if(riskDist <= 0)
      return 0;
   double rr = MathAbs(exitPx - entryPx) / riskDist;
   return (profit >= 0) ? rr : -rr;
  }

//+------------------------------------------------------------------+
void SyncHistory(bool fullHistory)
  {
   datetime from = fullHistory ? D'2015.01.01' : TimeCurrent() - 14 * 24 * 60 * 60;
   datetime to   = TimeCurrent();

   if(!HistorySelect(from, to))
     {
      Print("FinhubJournal_TradeSync: HistorySelect failed.");
      if(fullHistory)
         Alert("FinhubJournal_TradeSync: Could not load MT5 history.");
      return;
     }

   int total = HistoryDealsTotal();
   string batch = "";
   int batchCount = 0;
   int sent = 0;
   int failed = 0;

   for(int i = 0; i < total; i++)
     {
      ulong dealTicket = HistoryDealGetTicket(i);
      if(dealTicket == 0) continue;

      long entryType = HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
      if(!IsExitDeal(entryType)) continue;

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

      double entryPx = 0;
      datetime openTime = closeTime;
      ulong entryOrderTicket = 0;
      double entrySl = 0;
      FindEntry(posId, total, entryPx, openTime, entryOrderTicket, entrySl);
      double slPrice = StopLossOf(dealTicket, entryOrderTicket, entrySl);
      double rValue = CalcR(entryPx, exitPx, profit, slPrice);

      if(batchCount > 0) batch += ",";
      batch += TradeJson(dealTicket, symbol, direction, entryPx, exitPx,
                         volume, profit, rValue, slPrice, openTime, closeTime);
      batchCount++;

      if(batchCount >= BatchSize)
        {
         if(SendBatch(batch, batchCount))
            sent += batchCount;
         else
            failed += batchCount;
         batch = "";
         batchCount = 0;
        }
     }

   if(batchCount > 0)
     {
      if(SendBatch(batch, batchCount))
         sent += batchCount;
      else
         failed += batchCount;
     }

   if(sent + failed == 0)
     {
      Print("FinhubJournal_TradeSync: No closed trades found.");
      return;
     }

   Print("FinhubJournal_TradeSync: sent=", sent, " failed=", failed);
   if(fullHistory)
     {
      if(failed > 0 && sent == 0)
         Alert("FinhubJournal_TradeSync: Sync failed. Allow WebRequest for https://journal.finhubkh.com and https://finhubjournal.vercel.app, then reattach the EA.");
      else if(failed > 0)
         Alert("FinhubJournal_TradeSync: Partial sync — sent " + IntegerToString(sent) + ", failed " + IntegerToString(failed) + ".");
      else
         Alert("FinhubJournal_TradeSync: Synced " + IntegerToString(sent) + " trades.");
     }
  }

//+------------------------------------------------------------------+
int PostJson(string url, string json, string &response)
  {
   uchar postData[];
   int copied = StringToCharArray(json, postData, 0, WHOLE_ARRAY, CP_UTF8);
   if(copied > 0)
      ArrayResize(postData, copied - 1);

   string headers = "Content-Type: application/json\r\nx-sync-key: " + SyncKey + "\r\n";
   uchar result[];
   string resultHeaders;
   ResetLastError();
   int res = WebRequest("POST", url, headers, RequestTimeoutMs, postData, result, resultHeaders);
   response = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   return res;
  }

//+------------------------------------------------------------------+
bool SendBatch(string tradesCsv, int count)
  {
   string json = "{\"trades\":[" + tradesCsv + "]}";
   string response;
   int res = PostJson(EndpointPrimary, json, response);

   if(res == -1)
     {
      int err = GetLastError();
      Print("FinhubJournal_TradeSync: primary WebRequest failed. Error ", err, " — trying fallback.");
      ResetLastError();
      res = PostJson(EndpointFallback, json, response);
     }

   if(res == -1)
     {
      Print("FinhubJournal_TradeSync: WebRequest failed. Error ", GetLastError(),
            ". Add https://journal.finhubkh.com AND https://finhubjournal.vercel.app under Tools > Options > Expert Advisors > Allow WebRequest.");
      return false;
     }

   if(res < 200 || res >= 300)
     {
      Print("FinhubJournal_TradeSync: HTTP ", res, " Response: ", response);
      return false;
     }

   Print("FinhubJournal_TradeSync: HTTP ", res, " batch=", count, " Response: ", response);
   return true;
  }

//+------------------------------------------------------------------+
string SessionFromTime(datetime t)
  {
   MqlDateTime dt;
   TimeToStruct(t, dt);
   int hour = dt.hour;
   if(hour >= 7 && hour < 12) return "london";
   if(hour >= 12 && hour < 21) return "ny";
   return "asian";
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
