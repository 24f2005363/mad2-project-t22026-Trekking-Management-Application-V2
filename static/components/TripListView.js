export default {
    name: "TripListView",
    data() {
        return {
            trips: [],
            cancelMsg: "",
            csvExporting: false,
            csvFileUrl: "",
            csvMsg: ""
        }
    },
    created() {
        this.loadTrips()
    },
    methods: {
        async loadTrips() {
            try {
                let res = await fetch("/api/trekker/my-trips")
                if (res.ok) this.trips = await res.json()
            } catch (err) { console.log("Trips error") }
        },
        async cancelTrip(bookId) {
            if (!confirm("Cancel this booking?")) return
            this.cancelMsg = ""
            try {
                let res = await fetch("/api/trekker/cancel/" + bookId, { method: "POST" })
                let result = await res.json()
                if (res.ok) {
                    this.cancelMsg = result.message
                    this.loadTrips()
                } else {
                    alert(result.error || "Cancel failed")
                }
            } catch (err) { alert("Server error") }
        },
        async startCsvExport() {
            this.csvMsg = ""
            this.csvFileUrl = ""
            this.csvExporting = true
            try {
                let res = await fetch("/api/tasks/export-csv")
                if (res.ok) {
                    let data = await res.json()
                    this.pollCsvTask(data.task_id)
                } else {
                    this.csvMsg = "Export request failed"
                    this.csvExporting = false
                }
            } catch (err) {
                this.csvMsg = "Server error"
                this.csvExporting = false
            }
        },
        pollCsvTask(taskId) {
            let timer = setInterval(async () => {
                try {
                    let res = await fetch("/api/tasks/status/" + taskId)
                    if (res.ok) {
                        let data = await res.json()
                        if (data.state == "SUCCESS") {
                            clearInterval(timer)
                            this.csvExporting = false
                            if (data.result && data.result.file_url) {
                                this.csvFileUrl = data.result.file_url
                                this.csvMsg = "CSV ready for download"
                            } else {
                                this.csvMsg = "Export completed but file not found"
                            }
                        } else if (data.state == "FAILURE") {
                            clearInterval(timer)
                            this.csvExporting = false
                            this.csvMsg = "Export failed"
                        }
                    }
                } catch (err) {
                    clearInterval(timer)
                    this.csvExporting = false
                    this.csvMsg = "Poll error"
                }
            }, 2000)
        },
        badgeStyle(st) {
            if (st == "Booked") return "bg-success"
            if (st == "Cancelled") return "bg-danger"
            if (st == "Completed") return "bg-primary"
            if (st == "Paid") return "bg-success"
            if (st == "Pending") return "bg-warning text-dark"
            return "bg-secondary"
        }
    },
    template: `
        <div>
            <h4>My Bookings</h4>
            <div class="d-flex justify-content-between align-items-center mb-2">
                <div></div>
                <div>
                    <button class="btn btn-outline-secondary btn-sm" @click="startCsvExport" :disabled="csvExporting">
                        {{ csvExporting ? 'Generating...' : 'Export CSV' }}
                    </button>
                    <a v-if="csvFileUrl" :href="csvFileUrl" class="btn btn-success btn-sm ms-2" download>Download CSV</a>
                </div>
            </div>
            <div v-if="csvMsg" class="alert alert-info small">{{ csvMsg }}</div>
            <div v-if="cancelMsg" class="alert alert-info small">{{ cancelMsg }}</div>
            <div v-if="trips.length == 0" class="text-muted">No bookings yet.</div>
            <div v-else class="table-responsive">
                <table class="table table-hover align-middle">
                    <thead>
                        <tr>
                            <th>Trek</th>
                            <th>Dates</th>
                            <th>Seats</th>
                            <th>Status</th>
                            <th>Payment</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="b in trips" :key="b.book_id">
                            <td><strong>{{ b.trek_title }}</strong><br><span class="small text-muted">{{ b.place }}</span></td>
                            <td class="small">{{ b.start_date }} to {{ b.end_date }}</td>
                            <td>{{ b.slots }}</td>
                            <td><span class="badge" :class="badgeStyle(b.status)">{{ b.status }}</span></td>
                            <td><span class="badge" :class="badgeStyle(b.pay_status)">{{ b.pay_status }}</span></td>
                            <td>
                                <button v-if="b.status == 'Booked'" class="btn btn-outline-danger btn-sm" @click="cancelTrip(b.book_id)">Cancel</button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `
}
