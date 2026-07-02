import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      header: {
        title: "TransitRoute",
        open_menu: "Open menu",
        switch_language: "Switch language",
        open_profile: "Open profile"
      },
      nav: {
        primary: "Primary navigation",
        search: "Search",
        stations: "Stations",
        history: "History",
        saved: "Saved",
        alerts: "Alerts"
      },
      search: {
        japan: "Japan",
        korea: "Korea",
        hong_kong: "Hong Kong",
        hero_title: "Asia Rail",
        hero_subtitle: "Japan, Korea, and live Hong Kong MTR departures.",
        origin: "Origin",
        destination: "Destination",
        date: "Date",
        realtime_search: "Real-time Search",
        searching: "Searching...",
        plan_ai: "Plan with AI (High Thinking)",
        thinking: "Thinking...",
        ai_plan_title: "AI Transit Plan",
        ai_failed: "Unable to create a transit plan.",
        validation_required: "Enter both origin and destination.",
        validation_same_station: "Origin and destination must be different."
      },
      stations: {
        title: "Station catalog",
        all_stations: "Browse stations",
        pick_origin: "Choose an origin",
        pick_destination: "Choose a destination",
        search_placeholder: "Search station name",
        loading: "Loading stations...",
        unavailable: "The station catalog is unavailable.",
        none: "No matching stations."
      },
      workflow: {
        title: "Data workflow",
        subtitle: "The app only renders schedules returned by a connected provider. It never generates substitute departure data.",
        back: "Back to search",
        step_form: "Validate the search request",
        origin_empty: "Origin not selected",
        destination_empty: "Destination not selected",
        date_empty: "Date not selected",
        step_stations: "Load the bundled major-station catalog",
        step_search: "Request live schedules from {{provider}}",
        step_local: "Store activity on this device",
        local_body: "Search history, saved trips, seat choices, and alerts use localStorage.",
        adapter_pending: "Provider adapter required",
        adapter_body: "The endpoint rejects fabricated schedules and returns an explicit error until the live route adapter is connected.",
        live_ready: "Live provider connected",
        live_ready_body: "Hong Kong queries use the official MTR Next Train feed without an API key."
      },
      result: {
        today: "Today",
        adult: "Adult",
        modify: "Modify",
        fastest: "Fastest",
        earliest: "Earliest",
        cheapest: "Cheapest",
        cheapest_first: "Cheapest First",
        direct: "Direct",
        reserved_seat: "Reserved Seat",
        jr_pass_eligible: "JR Pass Eligible",
        origin_label: "ORIGIN",
        destination_label: "DESTINATION",
        all_times: "All Times",
        first_class: "First Class",
        economy_class: "Economy Class",
        non_stop: "Non-stop",
        select_seat: "Seat preference",
        unable_to_fetch: "Unable to fetch real-time data",
        no_results: "No real-time results yet",
        no_results_hint: "Connect the transit provider API key or try another route.",
        stops: "stops",
        save_trip: "Save trip",
        saved: "Saved",
        fare_unavailable: "Fare unavailable"
      },
      metro: {
        live_mtr: "Official MTR live data",
        realtime: "Live",
        towards: "Towards {{destination}}",
        next_departure: "Next departure",
        platform: "Platform",
        no_departures: "No matching live departures",
        no_departures_hint: "Try another pair of stations on the same supported MTR line.",
        save_departure: "Save"
      },
      history: {
        recent: "Recent searches",
        empty_title: "No searches yet",
        empty_body: "Your completed searches will appear here.",
        results: "results",
        search_again: "Search again"
      },
      saved: {
        empty_title: "No saved trips",
        empty_body: "Save a result to keep it here for later.",
        remove: "Remove saved trip"
      },
      alerts: {
        empty_title: "No alerts",
        empty_body: "Search, seat, and saved-trip updates will appear here.",
        search_failed: "Search failed",
        search_failed_body: "The transit provider did not return data.",
        network_error: "Network error",
        network_error_body: "Could not connect to the transit service.",
        trip_saved: "Trip saved",
        seat_selected: "Seat preference saved"
      },
      menu: {
        title: "Menu",
        new_search: "New search"
      },
      profile: {
        title: "Profile",
        guest: "Guest traveler",
        local_only: "History and saved trips stay on this device."
      },
      seat: {
        title: "Seat preference",
        standard: "Standard",
        window: "Window",
        aisle: "Aisle",
        first: "First class",
        confirm: "Save preference"
      }
    }
  },
  'zh-TW': {
    translation: {
      header: {
        title: "TransitRoute",
        open_menu: "開啟選單",
        switch_language: "切換語言",
        open_profile: "開啟個人資料"
      },
      nav: {
        primary: "主要導覽",
        search: "搜尋",
        stations: "車站",
        history: "紀錄",
        saved: "儲存",
        alerts: "通知"
      },
      search: {
        japan: "日本",
        korea: "韓國",
        hong_kong: "香港",
        hero_title: "亞洲鐵路",
        hero_subtitle: "日本、韓國與香港 MTR 官方即時班次。",
        origin: "出發地",
        destination: "目的地",
        date: "日期",
        realtime_search: "即時搜尋",
        searching: "搜尋中...",
        plan_ai: "AI 智慧規劃 (高階推理)",
        thinking: "思考中...",
        ai_plan_title: "AI 交通規劃",
        ai_failed: "目前無法建立交通規劃。",
        validation_required: "請輸入出發地和目的地。",
        validation_same_station: "出發地和目的地不能相同。"
      },
      stations: {
        title: "主要車站目錄",
        all_stations: "瀏覽車站",
        pick_origin: "選擇出發站",
        pick_destination: "選擇抵達站",
        search_placeholder: "搜尋車站名稱",
        loading: "正在載入車站...",
        unavailable: "目前無法讀取車站目錄。",
        none: "找不到符合的車站。"
      },
      workflow: {
        title: "資料流程",
        subtitle: "畫面只呈現已串接供應商回傳的班次，系統不產生替代或虛構時刻。",
        back: "返回搜尋",
        step_form: "驗證搜尋條件",
        origin_empty: "尚未選擇出發站",
        destination_empty: "尚未選擇抵達站",
        date_empty: "尚未選擇日期",
        step_stations: "讀取內建主要車站目錄",
        step_search: "向 {{provider}} 請求即時班次",
        step_local: "儲存在這台裝置",
        local_body: "搜尋紀錄、儲存行程、座位選擇與通知使用 localStorage。",
        adapter_pending: "尚需串接供應商 Adapter",
        adapter_body: "即時路線 Adapter 接通前，API 會明確回傳錯誤，不會填入假班次。",
        live_ready: "已連接即時資料",
        live_ready_body: "香港查詢直接使用 MTR 官方 Next Train feed，不需申請 API 金鑰。"
      },
      result: {
        today: "今天",
        adult: "成人",
        modify: "修改",
        fastest: "最快",
        earliest: "最早",
        cheapest: "最便宜",
        cheapest_first: "最便宜優先",
        direct: "直達",
        reserved_seat: "對號座",
        jr_pass_eligible: "適用 JR Pass",
        origin_label: "出發地",
        destination_label: "目的地",
        all_times: "所有時間",
        first_class: "頭等艙",
        economy_class: "經濟艙",
        non_stop: "直達",
        select_seat: "座位偏好",
        unable_to_fetch: "無法取得即時資料",
        no_results: "目前沒有即時結果",
        no_results_hint: "請設定交通 API key，或改查其他路線。",
        stops: "站",
        save_trip: "儲存行程",
        saved: "已儲存",
        fare_unavailable: "未提供票價"
      },
      metro: {
        live_mtr: "MTR 官方即時資料",
        realtime: "即時",
        towards: "往 {{destination}}",
        next_departure: "下一班發車",
        platform: "月台",
        no_departures: "目前沒有符合的即時班次",
        no_departures_hint: "請改選同一條支援路線上的其他起訖站。",
        save_departure: "儲存"
      },
      history: {
        recent: "近期搜尋",
        empty_title: "尚無搜尋紀錄",
        empty_body: "完成搜尋後會顯示在這裡。",
        results: "筆結果",
        search_again: "再次搜尋"
      },
      saved: {
        empty_title: "尚無儲存行程",
        empty_body: "在結果頁儲存班次後，就能在這裡快速查看。",
        remove: "移除儲存行程"
      },
      alerts: {
        empty_title: "沒有通知",
        empty_body: "搜尋、選座與儲存行程的狀態會顯示在這裡。",
        search_failed: "搜尋失敗",
        search_failed_body: "交通資料提供方沒有回傳資料。",
        network_error: "網路錯誤",
        network_error_body: "無法連線到交通服務。",
        trip_saved: "已儲存行程",
        seat_selected: "已儲存座位偏好"
      },
      menu: {
        title: "選單",
        new_search: "新的搜尋"
      },
      profile: {
        title: "個人資料",
        guest: "訪客旅人",
        local_only: "搜尋紀錄與儲存行程會保留在這台裝置。"
      },
      seat: {
        title: "座位偏好",
        standard: "標準座",
        window: "靠窗",
        aisle: "走道",
        first: "頭等艙",
        confirm: "儲存偏好"
      }
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'zh-TW', // default language
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
