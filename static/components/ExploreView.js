export default {
    name: "ExploreView",
    data() {
        return {
            filterDifficulty: "All",
            filterLocation: "",
            filterDuration: "All",
            results: []
        }
    },
    created() {
        this.doSearch()
    },
    methods: {
        async doSearch() {
            let params = new URLSearchParams()
            if (this.filterDifficulty != "All") params.set("difficulty", this.filterDifficulty)
            if (this.filterLocation.trim()) params.set("location", this.filterLocation)
            if (this.filterDuration != "All") params.set("duration", this.filterDuration)
            let url = "/api/trekker/explore?" + params.toString()
            try {
                let res = await fetch(url)
                if (res.ok) this.results = await res.json()
            } catch (err) { console.log("Explore error") }
        },
        openDetail(id) {
            this.$parent.viewRoute(id)
        }
    },
    template: `
        <div>
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
                        <button class="btn btn-primary btn-sm w-100" @click="doSearch">Search</button>
                    </div>
                </div>
            </div>
            <div v-if="results.length == 0" class="text-muted">No matching treks found.</div>
            <div v-else class="row">
                <div v-for="r in results" :key="r.id" class="col-md-4 mb-3">
                    <div class="card h-100 shadow-sm">
                        <div class="card-body">
                            <h5 class="card-title">{{ r.title }}</h5>
                            <p class="small text-muted mb-1">{{ r.place }} | {{ r.level }} | {{ r.duration }} days</p>
                            <p class="small">{{ r.about ? r.about.substring(0, 80) + '...' : '' }}</p>
                            <p class="small mb-1"><strong>Slots:</strong> {{ r.left_slots }} / {{ r.max_slots }}</p>
                            <p class="small">{{ r.start_date }} to {{ r.end_date }}</p>
                            <button class="btn btn-sm btn-success" @click="openDetail(r.id)">View & Book</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `
}
