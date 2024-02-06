import betagouv from "@betagouv";
import * as utils from "@controllers/utils";
import { DBUser, statusOptions, genderOptions } from "@/models/dbUser/dbUser";
import { MemberWithPermission } from "@/models/member";
import { PULL_REQUEST_STATE } from "@/models/pullRequests";
import db from "@db";
import { StartupInfo } from "@/models/startup";
import config from "@/server/config";

export async function getBaseInfoUpdateApi(req, res) {
    getBaseInfo(
        req,
        res,
        (data) => {
            res.json(data);
        },
        (err) => {
            console.error(err);
            res.status(500).json({
                error: "Impossible de récupérer vos informations.",
            });
        }
    );
}

const getBaseInfo = async (req, res, onSuccess, onError) => {
    try {
        const currentUser = await utils.userInfos(req.auth.id, true);
        const title = "Mon compte";
        const formValidationErrors = {};
        const startups: StartupInfo[] = await betagouv.startupsInfos();
        const startupOptions = startups.map((startup) => {
            return {
                value: startup.id,
                label: startup.attributes.name,
            };
        });
        const userStartups = (currentUser.userInfos?.startups || []).map(
            (userStartup) => {
                const startupInfo = startups.find((s) => s.id === userStartup);
                return {
                    value: userStartup,
                    label: startupInfo?.attributes.name,
                };
            }
        );
        const userPreviousStartups = (
            currentUser.userInfos?.previously || []
        ).map((userStartup) => {
            const startupInfo = startups.find((s) => s.id === userStartup);
            return {
                value: userStartup,
                label: startupInfo?.attributes.name,
            };
        });
        const updatePullRequest = await db("pull_requests")
            .where({
                username: req.auth.id,
                status: PULL_REQUEST_STATE.PR_MEMBER_UPDATE_CREATED,
            })
            .orderBy("created_at", "desc")
            .first();
        onSuccess({
            title,
            formValidationErrors,
            isAdmin: config.ESPACE_MEMBRE_ADMIN.includes(req.auth.id),
            currentUserId: req.auth.id,
            genderOptions,
            statusOptions,
            startupOptions,
            activeTab: "account",
            username: req.auth.id,
            updatePullRequest,
            formData: {
                startups: userStartups || [],
                role: currentUser.userInfos?.role,
                missions: currentUser.userInfos?.missions,
                end: currentUser.userInfos?.end,
                start: currentUser.userInfos?.start,
                previously: userPreviousStartups,
            },
        });
    } catch (err) {
        onError(err);
    }
};