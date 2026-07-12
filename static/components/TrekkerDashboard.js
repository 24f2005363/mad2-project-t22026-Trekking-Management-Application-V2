export default {
    name: "TrekkerDashboard",
    data() {
        return {
            viewMode: "home",
            userInfo: { name: "", email: "" },
            openRoutes: [],
            myReservations: [],
            selectedRoute: null,
            bookSeats: 1,
            bookMsg: "",
            bookError: "",
            // explore
            filterDifficulty: "All",
            filterLocation: "",
            filterDuration: "All",
            exploreResults: [],
            // trips
            allTrips: [],
            cancelMsg: "",
            // history
            pastTrips: [],
            // account
            acctName: "",
            acctMobile: "",
            acctMsg: "",
            acctError: ""
        }
    },
    created() {
        this.loadHome()
    },
    methods: {
        async loadHome() {
            try {
                let res = await fetch("/api/trekker/home")
                if (res.ok) {
                    let d = await res.json()
                    this.userInfo.name = d.user_name
                    this.openRoutes = d.open_routes
                    this.myReservations = d.my_trips
                }
            } catch (err) {
                console.log("Home load error")
            }
        },
        switchView(view) {
            this.viewMode = view
            this.bookMsg = ""
            this.bookError = ""
            this.cancelMsg = ""
            if (view == "explore") {
                this.doExplore()
            } else if (view == "trips") {
                this.loadTrips()
            } else if (view == "history") {
                this.loadHistory()
            } else if (view == "account") {
                this.loadAccount()
            } else if (view == "home") {
                this.loadHome()
            }
        },
        async openRoute(id) {
            try {
                let res = await fetch("/api/trekker/treks/" + id)
                if (res.ok) {
                    this.selectedRoute = await res.json()
                    this.bookSeats = 1
                    this.bookMsg = ""
                    this.bookError = ""
                    this.viewMode = "detail"
                }
            } catch (err) {
                console.log("Route detail error")
            }
        },
        async doExplore() {
            let url = "/api/trekker/explore?"
            if (this.filterDifficulty != "All") url = url + "difficulty=" + this.filterDifficulty + "&"
            if (this.filterLocation.trim()) url = url + "location=" + encodeURIComponent(this.filterLocation) + "&"
            if (this.filterDuration != "All") url = url + "duration=" + this.filterDuration
            try {
                let res = await fetch(url)
                if (res.ok) {
                    this.exploreResults = await res.json()
                }
            } catch (err) {
                console.log("Explore error")
            }
        },
        async bookThisRoute() {
            this.bookMsg = ""
            this.bookError = ""
            if (!this.bookSeats || this.bookSeats < 1) {
                this.bookError = "Select at least 1 seat"
                return
            }
            try {
                let res = await fetch("/api/trekker/reserve", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ trek_id: this.selectedRoute.id, seats: this.bookSeats })
                })
                let result = await res.json()
                if (res.ok) {
                    this.bookMsg = result.message + " (" + result.slots + " seats)"
                    this.selectedRoute.left_slots = this.selectedRoute.left_slots - this.bookSeats
                } else {
                    this.bookError = result.error || "Booking failed"
                }
            } catch (err) {
                this.bookError = "Server error"
            }
        },
        async loadTrips() {
            try {
                let res = await fetch("/api/trekker/my-trips")
                if (res.ok) {
                    this.allTrips = await res.json()
                }
            } catch (err) {
                console.log("Trips error")
            }
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
            } catch (err) {
                alert("Server error")
            }
        },
        async loadHistory() {
            try {
                let res = await fetch("/api/trekker/history")
                if (res.ok) {
                    this.pastTrips = await res.json()
                }
            } catch (err) {
                console.log("History error")
            }
        },
        async loadAccount() {
            try {
                let res = await fetch("/api/trekker/account")
                if (res.ok) {
                    let d = await res.json()
                    this.acctName = d.name
                    this.acctMobile = d.mobile
                    this.userInfo.email = d.email
                }
            } catch (err) {
                console.log("Account load error")
            }
        },
        async saveAccount() {
            this.acctMsg = ""
            this.acctError = ""
            if (!this.acctName.trim()) {
                this.acctError = "Name is required"
                return
            }
            try {
                let res = await fetch("/api/trekker/account", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: this.acctName, mobile: this.acctMobile })
                })
                let result = await res.json()
                if (res.ok) {
                    this.acctMsg = "Profile saved"
                    localStorage.setItem("user-name", this.acctName)
                    window.dispatchEvent(new Event("auth-changed"))
                } else {
                    this.acctError = result.error || "Save failed"
                }
            } catch (err) {
                this.acctError = "Server error"
            }
        },
        statusBadge(st) {
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
            <!-- Navigation tabs -->
            <ul class="nav nav-tabs mb-4">
                <li class="nav-item"><button class="nav-link" :class="{active: viewMode=='home'}" @click="switchView('home')">Dashboard</button></li>
                <li class="nav-item"><button class="nav-link" :class="{active: viewMode=='explore'}" @click="switchView('explore')">Explore</button></li>
                <li class="nav-item"><button class="nav-link" :class="{active: viewMode=='trips'}" @click="switchView('trips')">My Trips</button></li>
                <li class="nav-item"><button class="nav-link" :class="{active: viewMode=='history'}" @click="switchView('history')">History</button></li>
                <li class="nav-item"><button class="nav-link" :class="{active: viewMode=='account'}" @click="switchView('account')">Account</button></li>
            </ul>

            <!-- HOME / DASHBOARD -->
            <div v-if="viewMode == 'home'">
                <h3 class="mb-3">Welcome, {{ userInfo.name }}</h3>
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
                                            <button class="btn btn-sm btn-outline-primary mt-1" @click="openRoute(r.id)">View</button>
                                        </div>
                                    </div>
                                </div>
                                <button class="btn btn-link btn-sm p-0" @click="switchView('explore')">See all &rarr;</button>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card p-3 shadow-sm mb-3">
                            <h5>My Bookings <span class="badge bg-info">{{ myReservations.length }}</span></h5>
                            <div v-if="myReservations.length == 0" class="text-muted small">No bookings yet.</div>
                            <div v-else>
                                <div v-for="b in myReservations.slice(0, 5)" :key="b.book_id" class="border-bottom pb-2 mb-2">
                                    <div class="d-flex justify-content-between">
                                        <div><strong>{{ b.trek_title }}</strong><br><span class="small text-muted">{{ b.start_date }} to {{ b.end_date }}</span></div>
                                        <div class="text-end">
                                            <span class="badge" :class="statusBadge(b.status)">{{ b.status }}</span>
                                        </div>
                                    </div>
                                </div>
                                <button class="btn btn-link btn-sm p-0" @click="switchView('trips')">All trips &rarr;</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- EXPLORE -->
            <div v-if="viewMode == 'explore'">
                <h4>Explore Treks</h4>
                <div class="card p-3 mb-3 shadow-sm">
                    <div class="row g-2">
                        <div class="col-md-3">
                            <label class="small">Difficulty</label>
                            <select class="form-select form-select-sm" v-model="filterDifficulty">
                                <option>All</option>
                                <option>Easy</option>
                                <option>Moderate</option>
                                <option>Hard</option>
                            </select>
                        </div>
                        <div class="col-md-3">
                            <label class="small">Location</label>
                            <input type="text" class="form-control form-control-sm" v-model="filterLocation" placeholder="Any">
                        </div>
                        <div class="col-md-3">
                            <label class="small">Max Duration (days)</label>
                            <select class="form-select form-select-sm" v-model="filterDuration">
                                <option>All</option>
                                <option>3</option>
                                <option>5</option>
                                <option>7</option>
                                <option>10</option>
                                <option>14</option>
                            </select>
                        </div>
                        <div class="col-md-3 d-flex align-items-end">
                            <button class="btn btn-primary btn-sm w-100" @click="doExplore">Search</button>
                        </div>
                    </div>
                </div>
                <div v-if="exploreResults.length == 0" class="text-muted">No matching treks found.</div>
                <div v-else class="row">
                    <div v-for="r in exploreResults" :key="r.id" class="col-md-4 mb-3">
                        <div class="card h-100 shadow-sm">
                            <div class="card-body">
                                <h5 class="card-title">{{ r.title }}</h5>
                                <p class="small text-muted mb-1">{{ r.place }} | {{ r.level }} | {{ r.duration }} days</p>
                                <p class="small">{{ r.about ? r.about.substring(0, 80) + '...' : '' }}</p>
                                <p class="small mb-1"><strong>Slots:</strong> {{ r.left_slots }} / {{ r.max_slots }}</p>
                                <p class="small">{{ r.start_date }} to {{ r.end_date }}</p>
                                <button class="btn btn-sm btn-success" @click="openRoute(r.id)">View & Book</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- DETAIL -->
            <div v-if="viewMode == 'detail' && selectedRoute">
                <button class="btn btn-outline-secondary btn-sm mb-3" @click="switchView('explore')">&larr; Back</button>
                <div class="card p-4 shadow-sm">
                    <h3>{{ selectedRoute.title }}</h3>
                    <p class="text-muted">{{ selectedRoute.place }} | {{ selectedRoute.level }} | {{ selectedRoute.duration }} days</p>
                    <p><strong>Dates:</strong> {{ selectedRoute.start_date }} to {{ selectedRoute.end_date }}</p>
                    <p><strong>Available Slots:</strong> {{ selectedRoute.left_slots }} / {{ selectedRoute.max_slots }}</p>
                    <p><strong>About:</strong> {{ selectedRoute.about || 'No description' }}</p>
                    <div v-if="selectedRoute.status == 'Open' && selectedRoute.left_slots > 0">
                        <div v-if="bookMsg" class="alert alert-success small">{{ bookMsg }}</div>
                        <div v-if="bookError" class="alert alert-danger small">{{ bookError }}</div>
                        <div class="row g-2 align-items-center">
                            <div class="col-auto">
                                <label class="small">Seats:</label>
                                <input type="number" class="form-control form-control-sm" style="width:80px" v-model.number="bookSeats" min="1" :max="selectedRoute.left_slots">
                            </div>
                            <div class="col-auto">
                                <button class="btn btn-primary btn-sm mt-3" @click="bookThisRoute" :disabled="selectedRoute.left_slots < 1">Book Now</button>
                            </div>
                        </div>
                    </div>
                    <div v-else>
                        <span class="text-danger">This trek is not available for booking.</span>
                    </div>
                </div>
            </div>

            <!-- MY TRIPS -->
            <div v-if="viewMode == 'trips'">
                <h4>My Bookings</h4>
                <div v-if="cancelMsg" class="alert alert-info small">{{ cancelMsg }}</div>
                <div v-if="allTrips.length == 0" class="text-muted">No bookings yet.</div>
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
                            <tr v-for="b in allTrips" :key="b.book_id">
                                <td><strong>{{ b.trek_title }}</strong><br><span class="small text-muted">{{ b.place }}</span></td>
                                <td class="small">{{ b.start_date }} to {{ b.end_date }}</td>
                                <td>{{ b.slots }}</td>
                                <td><span class="badge" :class="statusBadge(b.status)">{{ b.status }}</span></td>
                                <td><span class="badge" :class="statusBadge(b.pay_status)">{{ b.pay_status }}</span></td>
                                <td>
                                    <button v-if="b.status == 'Booked'" class="btn btn-outline-danger btn-sm" @click="cancelTrip(b.book_id)">Cancel</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- HISTORY -->
            <div v-if="viewMode == 'history'">
                <h4>Past Trips</h4>
                <div v-if="pastTrips.length == 0" class="text-muted">No history yet.</div>
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
                            <tr v-for="b in pastTrips" :key="b.book_id">
                                <td><strong>{{ b.trek_title }}</strong></td>
                                <td>{{ b.place }}</td>
                                <td class="small">{{ b.start_date }} to {{ b.end_date }}</td>
                                <td>{{ b.slots }}</td>
                                <td><span class="badge" :class="statusBadge(b.status)">{{ b.status }}</span></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- ACCOUNT -->
            <div v-if="viewMode == 'account'">
                <h4>My Account</h4>
                <div class="card p-4 shadow-sm" style="max-width:500px">
                    <div v-if="acctMsg" class="alert alert-success small">{{ acctMsg }}</div>
                    <div v-if="acctError" class="alert alert-danger small">{{ acctError }}</div>
                    <div class="mb-3">
                        <label class="form-label">Name</label>
                        <input type="text" class="form-control" v-model="acctName">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Email (not editable)</label>
                        <input type="text" class="form-control" :value="userInfo.email" disabled>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Mobile</label>
                        <input type="text" class="form-control" v-model="acctMobile">
                    </div>
                    <button class="btn btn-primary" @click="saveAccount">Save Changes</button>
                </div>
            </div>
        </div>
    `
}
