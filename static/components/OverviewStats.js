export default {
    name: "OverviewStats",
    data() {
        return {
            stats: { total_treks: 0, total_users: 0, total_staff: 0, total_bookings: 0 },
            reportMsg: "",
            sending: false
        }
    },
    created() {
        this.fetchStats()
    },
    methods: {
        async fetchStats() {
            try {
                const res = await fetch("/api/admin-stats")
                if (res.ok) this.stats = await res.json()
            } catch (err) {
                console.log("Stats load error")
            }
        },
        async triggerMonthlyReport() {
            this.sending = true
            this.reportMsg = ""
            try {
                const res = await fetch("/api/tasks/trigger-report")
                if (res.ok) {
                    this.reportMsg = "Monthly report task started"
                } else {
                    this.reportMsg = "Failed to trigger report"
                }
            } catch (err) {
                this.reportMsg = "Server error"
            }
            this.sending = false
        }
    },
    template: `
        <div>
            <div class="row">
                <div class="col-md-3">
                    <div class="card bg-primary text-white p-3 mb-3 shadow-sm">
                        <h6>Total Treks</h6>
                        <h3>{{ stats.total_treks }}</h3>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card bg-success text-white p-3 mb-3 shadow-sm">
                        <h6>Guides / Staff</h6>
                        <h3>{{ stats.total_staff }}</h3>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card bg-info text-white p-3 mb-3 shadow-sm">
                        <h6>Registered Clients</h6>
                        <h3>{{ stats.total_users }}</h3>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card bg-warning text-dark p-3 mb-3 shadow-sm">
                        <h6>Total Bookings</h6>
                        <h3>{{ stats.total_bookings }}</h3>
                    </div>
                </div>
            </div>
            <div class="card p-3 shadow-sm mt-3">
                <div class="d-flex justify-content-between align-items-center">
                    <h5 class="mb-0">Administration Actions</h5>
                    <div>
                        <button class="btn btn-outline-info btn-sm" @click="triggerMonthlyReport" :disabled="sending">
                            {{ sending ? 'Sending...' : 'Send Monthly Report' }}
                        </button>
                    </div>
                </div>
                <div v-if="reportMsg" class="alert alert-info small mt-2 mb-0">{{ reportMsg }}</div>
            </div>
        </div>
    `
}
