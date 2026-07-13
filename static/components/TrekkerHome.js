export default {
    name: "TrekkerHome",
    data() {
        return {
            userName: "",
            openRoutes: [],
            myTrips: []
        }
    },
    created() {
        this.loadData()
    },
    methods: {
        async loadData() {
            try {
                let res = await fetch("/api/trekker/home")
                if (res.ok) {
                    let d = await res.json()
                    this.userName = d.user_name
                    this.openRoutes = d.open_routes
                    this.myTrips = d.my_trips
                }
            } catch (err) { console.log("Home load error") }
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
            <h3 class="mb-3">Welcome, {{ userName }}</h3>
            <div class="row">
                <div class="col-md-6">
                    <div class="card p-3 shadow-sm mb-3">
                        <h5>Open Treks <span class="badge bg-success">{{ openRoutes.length }}</span></h5>
                        <div v-if="openRoutes.length == 0" class="text-muted small">No treks available right now.</div>
                        <div v-else>
                            <div v-for="r in openRoutes.slice(0, 5)" :key="r.id" class="border-bottom pb-2 mb-2">
                                <div class="d-flex justify-content-between">
                                    <div><strong>{{ r.title }}</strong><br><span class="small text-muted">{{ r.place }} | {{ r.duration }} days</span></div>
                                    <div class="text-end">
                                        <span class="small">{{ r.left_slots }}/{{ r.max_slots }} slots</span><br>
                                        <button class="btn btn-sm btn-outline-primary mt-1" @click="$parent.switchView('explore')">View</button>
                                    </div>
                                </div>
                            </div>
                            <button class="btn btn-link btn-sm p-0" @click="$parent.switchView('explore')">See all &rarr;</button>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card p-3 shadow-sm mb-3">
                        <h5>My Bookings <span class="badge bg-info">{{ myTrips.length }}</span></h5>
                        <div v-if="myTrips.length == 0" class="text-muted small">No bookings yet.</div>
                        <div v-else>
                            <div v-for="b in myTrips.slice(0, 5)" :key="b.book_id" class="border-bottom pb-2 mb-2">
                                <div class="d-flex justify-content-between">
                                    <div><strong>{{ b.trek_title }}</strong><br><span class="small text-muted">{{ b.start_date }} to {{ b.end_date }}</span></div>
                                    <div class="text-end">
                                        <span class="badge" :class="badgeStyle(b.status)">{{ b.status }}</span>
                                    </div>
                                </div>
                            </div>
                            <button class="btn btn-link btn-sm p-0" @click="$parent.switchView('trips')">All trips &rarr;</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `
}
