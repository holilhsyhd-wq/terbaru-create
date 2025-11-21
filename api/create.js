// api/create.js
const crypto = require("crypto");
const config = require("../config");

const VALID_RAM = ["1","2","3","4","5","6","7","8","9","unlimited"];

function ramToMemoryMb(ram) {
    if (ram === "unlimited") return 0; // 0 = unlimited di Pterodactyl
    const v = parseInt(ram, 10);
    if (isNaN(v) || v <= 0) return 1024; // default 1GB
    return v * 1024;
}

async function pteroRequest(path, options = {}) {
    const base = config.pterodactyl.domain.replace(/\/+$/, "");
    const url = `${base}/api/application${path}`;

    const headers = {
        "Authorization": `Bearer ${config.pterodactyl.apiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
        ...(options.headers || {})
    };

    const res = await fetch(url, { ...options, headers });

    let bodyText = await res.text();
    let bodyJson;
    try {
        bodyJson = bodyText ? JSON.parse(bodyText) : null;
    } catch {
        bodyJson = null;
    }

    if (!res.ok) {
        const msg =
            (bodyJson && bodyJson.errors && bodyJson.errors[0] && bodyJson.errors[0].detail) ||
            (bodyJson && bodyJson.message) ||
            bodyText ||
            `Pterodactyl error ${res.status}`;
        throw new Error(msg);
    }

    return bodyJson;
}

function randomPassword(len = 12) {
    return crypto.randomBytes(len).toString("base64").slice(0, len);
}

async function createUser({ email, username, rootAdmin }) {
    const password = randomPassword(14);

    const payload = {
        email,
        username,
        first_name: "Panel",
        last_name: rootAdmin ? "Admin" : "User",
        password,
        root_admin: !!rootAdmin,
        language: "en"
    };

    const data = await pteroRequest("/users", {
        method: "POST",
        body: JSON.stringify(payload)
    });

    return {
        id: data.attributes.id,
        uuid: data.attributes.uuid,
        password
    };
}

async function createServer({ userId, ram, isAdmin }) {
    const memory = ramToMemoryMb(ram);

    const limits = {
        memory,
        swap: 0,
        disk: config.pterodactyl.disk,
        io: 500,
        cpu: config.pterodactyl.cpu
    };

    const feature_limits = {
        databases: 2,
        allocations: 1,
        backups: 1
    };

    const environment = {
        ...config.pterodactyl.extra_environment
        // Kalau egg kamu butuh env khusus, taruh di sini
    };

    const payload = {
        name: isAdmin ? "Admin Panel" : "User Panel",
        description: isAdmin ? "Admin Pterodactyl" : "User Pterodactyl",
        user: userId,
        egg: config.pterodactyl.eggId,
        docker_image: config.pterodactyl.docker_image,
        startup: config.pterodactyl.startupCmd,
        limits,
        feature_limits,
        environment,
        deploy: {
            locations: [config.pterodactyl.locationId],
            dedicated_ip: false,
            port_range: []
        },
        start_on_completion: true
    };

    const data = await pteroRequest("/servers", {
        method: "POST",
        body: JSON.stringify(payload)
    });

    return {
        id: data.attributes.id,
        uuid: data.attributes.uuid,
        identifier: data.attributes.identifier
    };
}

// Handler untuk Vercel (CommonJS)
module.exports = async (req, res) => {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        // Di Vercel body sudah di-parse
        const body = req.body || {};
        const { type, ram, email } = body;

        if (!type || !["panel", "admin"].includes(type)) {
            return res.status(400).json({ error: "type harus 'panel' atau 'admin'." });
        }

        if (!ram || !VALID_RAM.includes(String(ram))) {
            return res.status(400).json({ error: "RAM tidak valid. Pilih 1–9 atau unlimited." });
        }

        if (!email) {
            return res.status(400).json({ error: "email wajib diisi." });
        }

        let username;
        if (type === "admin") {
            if (!body.username) {
                return res.status(400).json({ error: "username wajib untuk admin." });
            }
            username = String(body.username).toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 32);
        } else {
            // panel: generate username dari domain
            if (!body.domain) {
                return res.status(400).json({ error: "domain wajib diisi untuk panel." });
            }
            username = String(body.domain)
                .toLowerCase()
                .replace(/https?:\/\//, "")
                .replace(/[^a-z0-9]/g, "")
                .slice(0, 32) || "userpanel";
        }

        const isAdmin = type === "admin";

        // 1. Buat user
        const user = await createUser({
            email,
            username,
            rootAdmin: isAdmin
        });

        // 2. Buat server
        const server = await createServer({
            userId: user.id,
            ram,
            isAdmin
        });

        const ramText = ram === "unlimited" ? "Unlimited" : `${ram} GB`;

        return res.status(200).json({
            success: true,
            message: `Berhasil membuat ${isAdmin ? "Admin Panel" : "Panel"} dengan RAM ${ramText}.`,
            user: {
                id: user.id,
                uuid: user.uuid,
                username,
                email,
                password: user.password
            },
            server
        });
    } catch (err) {
        console.error("Create error:", err);
        return res.status(500).json({ error: err.message || "Internal server error." });
    }
};
