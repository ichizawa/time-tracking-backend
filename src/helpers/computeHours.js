function computeHours(timeIn, timeOut) {
    const start = new Date(`1970-01-01T${timeIn}`);
    const end = new Date(`1970-01-01T${timeOut}`);

    let diffMs = end - start;
    if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000;

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