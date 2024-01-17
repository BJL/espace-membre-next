"use client";
import axios from "axios";
import type { Metadata } from "next";
import { useEffect, useState } from "react";
import routes, { computeRoute } from "@/routes/routes";
import {
    AdminMattermost,
    AdminMattermostProps,
} from "@/components/AdminMattermostPage/AdminMattermost";

export default function Page() {
    const [data, setData] = useState({});
    const [isLoading, setLoading] = useState(true);
    useEffect(() => {
        axios
            .get(computeRoute(routes.ADMIN_MATTERMOST_API), {
                withCredentials: true,
            })
            .then((res) => {
                setData(res.data);
                setLoading(false);
            });
    }, []);

    if (isLoading) return <p>Chargement...</p>;
    if (!data) return <p>No profile data</p>;

    return <AdminMattermost {...(data as AdminMattermostProps)} />;
}
