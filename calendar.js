// Wrapped in IIFE
(() => {
    document.addEventListener('DOMContentLoaded', async () => {
        const calendarWrapper = document.getElementById('calendar-wrapper');
        if (!calendarWrapper) return;

        // Use the initialized client from config.js
        // Use the initialized client from config.js
        let supabase = window.supabaseClient;

        if (!supabase) {
            // Retry init using global config if available
            const provider = window.supabase || window.Supabase;
            if (provider && provider.createClient && window.SUPABASE_URL && window.SUPABASE_KEY) {
                console.warn('Supabase client was missing in calendar.js, initializing lazily...');
                try {
                    window.supabaseClient = provider.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
                    supabase = window.supabaseClient;
                } catch (e) {
                    console.error('Lazy init failed:', e);
                }
            }

            if (!supabase) {
                console.error('Supabase client not initialized in calendar.js. SDK Loaded:', !!(window.supabase || window.Supabase), 'URL avail:', !!window.SUPABASE_URL);
                return;
            }
        }

        // Start Jan 2026, End Feb 2027
        const startDate = new Date(2026, 0, 1);
        const endDate = new Date(2027, 2, 0); // Last day of Feb 2027

        let currentDate = new Date(startDate);

        // Grid container for months
        const grid = document.createElement('div');
        grid.className = 'calendar-grid';

        // Fetch Data
        const { data: types, error: typesError } = await supabase
            .from('calendar_types')
            .select('*');

        const { data: events, error: eventsError } = await supabase
            .from('calendar_events')
            .select('event_date, type_id');

        if (typesError || eventsError) {
            console.error('Error fetching calendar data', typesError, eventsError);
        }

        // Render Legend
        if (types && types.length > 0) {
            const legendDiv = document.createElement('div');
            legendDiv.className = 'calendar-legend';
            legendDiv.style.marginBottom = '2rem';
            legendDiv.style.display = 'flex';
            legendDiv.style.gap = '1.5rem';
            legendDiv.style.flexWrap = 'wrap';
            legendDiv.style.justifyContent = 'center';

            types.forEach(type => {
                const item = document.createElement('div');
                item.style.display = 'flex';
                item.style.alignItems = 'center';
                item.innerHTML = `
                    <span style="display:inline-block; width:15px; height:15px; background:${type.color}; margin-right:8px; border-radius:50%;"></span>
                    <span style="font-size:0.9rem;">${type.label}</span>
                `;
                legendDiv.appendChild(item);
            });

            // Insert legend before grid
            calendarWrapper.appendChild(legendDiv);
        }

        // Map events for easy lookup: 'YYYY-MM-DD' -> type_id
        const eventMap = {};
        if (events) {
            events.forEach(e => {
                eventMap[e.event_date] = e.type_id;
            });
        }

        // Type Map for colors
        const typeMap = {};
        if (types) {
            types.forEach(t => {
                typeMap[t.id] = t;
            });
        }

        while (currentDate <= endDate) {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();

            const monthDiv = document.createElement('div');
            monthDiv.className = 'calendar-month';

            const monthTitle = document.createElement('div');
            monthTitle.className = 'month-title';
            monthTitle.innerText = `${year}年 ${month + 1}月`;
            monthDiv.appendChild(monthTitle);

            const daysDiv = document.createElement('div');
            daysDiv.className = 'month-days';

            // Get days in month
            const daysInMonth = new Date(year, month + 1, 0).getDate();

            // Header for days of week
            const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
            const weekHeader = document.createElement('div');
            weekHeader.className = 'week-header';
            weekDays.forEach(d => {
                const span = document.createElement('span');
                span.innerText = d;
                weekHeader.appendChild(span);
            });
            monthDiv.appendChild(weekHeader);


            const datesGrid = document.createElement('div');
            datesGrid.className = 'dates-grid';

            // Empty slots for start of month
            const firstDay = new Date(year, month, 1).getDay();
            for (let i = 0; i < firstDay; i++) {
                const empty = document.createElement('div');
                empty.className = 'date-cell empty';
                datesGrid.appendChild(empty);
            }

            for (let d = 1; d <= daysInMonth; d++) {
                const dateCell = document.createElement('div');
                dateCell.className = 'date-cell';
                dateCell.innerText = d;

                // Check if this date is in schedule
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

                if (eventMap[dateStr]) {
                    const typeId = eventMap[dateStr];
                    const type = typeMap[typeId];
                    if (type) {
                        dateCell.classList.add('event-day');
                        // Override color dynamically
                        dateCell.style.backgroundColor = type.color;
                        dateCell.style.color = '#fff'; // Assuming dark colors usually
                        dateCell.title = type.label;
                    }
                }

                datesGrid.appendChild(dateCell);
            }

            monthDiv.appendChild(datesGrid);
            grid.appendChild(monthDiv);

            // Next month
            currentDate.setMonth(currentDate.getMonth() + 1);
        }

        calendarWrapper.appendChild(grid);
    });
})();
