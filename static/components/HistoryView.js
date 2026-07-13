export default {
    name: "HistoryView",
    data() {
        return {
            trips: []
        }
    },
    created() {
        this.loadHistory()
    },
    methods: {
        async loadHistory() {
            try {
                let res = await fetch("/api/trekker/history")
                if (res.ok) this.trips = await res.json()
            } catch (err) { console.log("History error") }
        },
        badgeStyle(st) {
            if (st == "Booked") return "bg-success"
            if (st == "Cancelled") return "bg-danger"
            if (st == "Completed") return "bg-primary"
            return "bg-secondary"
        }
    },
    template: `
        <div>
            <h4>Past Trips</h4>
            <div v-if="trips.length == 0" class="text-muted">No history yet.</div>
            <div v-else class="table-responsive">
                <table class="table table-hover align-middle">
                    <thead>
                        <tr>
                            <th>Trek</th>
                            <th>Location</th>
                            <th>Dates</th>
                            <th>Seats</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="b in trips" :key="b.book_id">
                            <td><strong>{{ b.trek_title }}</strong></td>
                            <td>{{ b.place }}</td>
                            <td class="small">{{ b.start_date }} to {{ b.end_date }}</td>
                            <td>{{ b.slots }}</td>
                            <td><span class="badge" :class="badgeStyle(b.status)">{{ b.status }}</span></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `
}
