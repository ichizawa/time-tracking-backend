function computeHours(timeIn, timeOut) {
    const start = new Date(timeIn);
    const end = new Date(timeOut);

    const diffMs = end.getTime() - start.getTime();

    const totalHours = diffMs / (1000 * 60 * 60);

    const hours = Math.floor(totalHours);
    const minutes = Math.round((totalHours - hours) * 60);

    return {
        totalWorkedHours: Number(totalHours.toFixed(2)),
        hours,
        minutes
    };
}

module.exports = { computeHours };