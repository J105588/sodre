document.addEventListener('DOMContentLoaded', () => {
    const calendarWrapper = document.getElementById('calendar-wrapper');
    if (!calendarWrapper) return;

    // Start Jan 2026, End Feb 2027
    const startDate = new Date(2026, 0, 1);
    const endDate = new Date(2027, 2, 0); // Last day of Feb 2027

    let currentDate = new Date(startDate);

    // Grid container for months
    const grid = document.createElement('div');
    grid.className = 'calendar-grid';

    // Mock schedule data (Random dates for demo)
    const scheduleDates = [
        '2026-01-15', '2026-01-20', '2026-02-10', '2026-03-05',
        '2026-04-12', '2026-05-18', '2026-06-22', '2026-07-30',
        '2026-08-15', '2026-09-10', '2026-10-05', '2026-11-20',
        '2026-12-15', '2027-01-10', '2027-02-14'
    ];

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

        // Simple list of days or simplified view for schedule
        // For distinct visual, let's just show "Event Days" highlighted or a simple grid

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
            if (scheduleDates.includes(dateStr)) {
                dateCell.classList.add('event-day');
                dateCell.title = '無料体験会 開催日';
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
