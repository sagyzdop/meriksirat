import { CalendarUI } from "../equipment-detail/calendar";
import { EquipmentDetail } from "./equipment-detail";

export function Page() {
    return (
        <div className="w-full h-150">
            <EquipmentDetail />
            <iframe
                src="https://calendar.google.com/calendar/embed?height=600&wkst=2&ctz=Asia%2FAlmaty&showPrint=0&showTitle=0&showTz=0&mode=WEEK&showCalendars=0&src=Y182YWZiN2RkOGI0ZDQzNmEwODlkNmQxNjQ5NWE2ZmYwZGQ1MmNhODVlNGNjMzU5MTg1ZWZjNDc2ODJjZDQ5YTJiQGdyb3VwLmNhbGVuZGFyLmdvb2dsZS5jb20&color=%237986cb"
                className="w-full h-full min-h-100px border-0"
                style={{ borderWidth: 0 }}
                allowFullScreen
            ></iframe>
            <CalendarUI />
        </div>
    );
}