function calculateNightDifferential(timeIn, timeOut) {
    let ndMinutes = 0;

    let current = new Date(timeIn);
    const end = new Date(timeOut);

    while (current < end) {
        const hour = current.getHours();

        if (hour >= 22 || hour < 6) {
            ndMinutes++;
        }

        current.setMinutes(current.getMinutes() + 1);
    }

    return Number((ndMinutes / 60).toFixed(2));
}

module.exports = { calculateNightDifferential };